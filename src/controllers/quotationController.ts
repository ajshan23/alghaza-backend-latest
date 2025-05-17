import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Quotation } from "../models/quotationModel";
import { Project } from "../models/projectModel";
import { Estimation } from "../models/estimationModel";
import { uploadItemImage, deleteFileFromS3 } from "../utils/uploadConf";
import puppeteer from "puppeteer";
import { generateRelatedDocumentNumber } from "../utils/documentNumbers";

export const createQuotation = asyncHandler(
  async (req: Request, res: Response) => {
    // Debugging logs
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);

    if (!req.files || !Array.isArray(req.files)) {
      throw new ApiError(400, "No files were uploaded");
    }

    // Parse the JSON data from form-data
    let jsonData;
    try {
      jsonData = JSON.parse(req.body.data);
    } catch (error) {
      throw new ApiError(400, "Invalid JSON data format");
    }

    const {
      project: projectId,
      validUntil,
      scopeOfWork = [],
      items = [],
      termsAndConditions = [],
      vatPercentage = 5,
    } = jsonData;

    // Validate items is an array
    if (!Array.isArray(items)) {
      throw new ApiError(400, "Items must be an array");
    }

    // Check for existing quotation
    const exists = await Quotation.findOne({ project: projectId });
    if (exists) throw new ApiError(400, "Project already has a quotation");

    const estimation = await Estimation.findOne({ project: projectId });
    const estimationId = estimation?._id;

    // Process items with their corresponding files
    const processedItems = await Promise.all(
      items.map(async (item: any, index: number) => {
        // Find the image file for this item using the correct fieldname pattern
        const imageFile = (req.files as Express.Multer.File[]).find(
          (f) => f.fieldname === `items[${index}][image]`
        );

        if (imageFile) {
          console.log(`Processing image for item ${index}:`, imageFile);
          const uploadResult = await uploadItemImage(imageFile);
          if (uploadResult.uploadData) {
            item.image = uploadResult.uploadData;
          }
        } else {
          console.log(`No image found for item ${index}`);
        }

        item.totalPrice = item.quantity * item.unitPrice;
        return item;
      })
    );

    // Calculate financial totals
    const subtotal = processedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const vatAmount = subtotal * (vatPercentage / 100);
    const total = subtotal + vatAmount;

    const quotation = await Quotation.create({
      project: projectId,
      estimation: estimationId,
      quotationNumber: await generateRelatedDocumentNumber(projectId, "QTN"),
      date: new Date(),
      validUntil: new Date(validUntil),
      scopeOfWork,
      items: processedItems,
      termsAndConditions,
      vatPercentage,
      subtotal,
      vatAmount,
      netAmount: total,
      preparedBy: req.user?.userId,
    });

    await Project.findByIdAndUpdate(projectId, { status: "quotation_sent" });

    res.status(201).json(new ApiResponse(201, quotation, "Quotation created"));
  }
);

export const getQuotationByProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const quotation = await Quotation.findOne({ project: projectId })
      .populate("project", "projectName")
      .populate("preparedBy", "firstName lastName");

    if (!quotation) throw new ApiError(404, "Quotation not found");
    res
      .status(200)
      .json(new ApiResponse(200, quotation, "Quotation retrieved"));
  }
);

export const updateQuotation = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { items, ...updateData } = req.body;

    const quotation = await Quotation.findById(id);
    if (!quotation) throw new ApiError(404, "Quotation not found");

    if (items) {
      quotation.items = await Promise.all(
        items.map(async (item: any, index: number) => {
          // Type the files object properly
          const files = req.files as
            | { [fieldname: string]: Express.Multer.File[] }
            | undefined;
          const fileKey = `items[${index}][image]`;

          if (files?.[fileKey]?.[0]) {
            // Delete old image if it exists
            if (item.image?.key) {
              await deleteFileFromS3(item.image.key);
            }

            // Upload new image
            const uploadResult = await uploadItemImage(files[fileKey][0]);
            if (uploadResult.uploadData) {
              item.image = uploadResult.uploadData;
            }
          }

          // Calculate total price
          item.totalPrice = item.quantity * item.unitPrice;
          return item;
        })
      );
    }

    Object.assign(quotation, updateData);
    await quotation.save();

    res.status(200).json(new ApiResponse(200, quotation, "Quotation updated"));
  }
);

export const approveQuotation = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { isApproved, comment } = req.body;

    const quotation = await Quotation.findByIdAndUpdate(
      id,
      {
        isApproved,
        approvalComment: comment,
        approvedBy: req.user?.userId,
      },
      { new: true }
    );

    await Project.findByIdAndUpdate(quotation?.project, {
      status: isApproved ? "quotation_approved" : "quotation_rejected",
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          quotation,
          `Quotation ${isApproved ? "approved" : "rejected"}`
        )
      );
  }
);

export const deleteQuotation = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const quotation = await Quotation.findByIdAndDelete(id);

    if (!quotation) throw new ApiError(404, "Quotation not found");

    await Promise.all(
      quotation.items.map((item) =>
        item.image?.key ? deleteFileFromS3(item.image.key) : Promise.resolve()
      )
    );

    await Project.findByIdAndUpdate(quotation.project, {
      status: "estimation_prepared",
    });

    res.status(200).json(new ApiResponse(200, null, "Quotation deleted"));
  }
);

export const generateQuotationPdf = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Populate all necessary fields
    const quotation = await Quotation.findById(id)
      .populate({
        path: "project",
        select: "projectName client siteAddress",
        populate: {
          path: "client",
          select: "clientName clientAddress mobileNumber telephoneNumber email",
        },
      })
      .populate("preparedBy", "firstName lastName signatureImage")
      .populate("approvedBy", "firstName lastName signatureImage");

    if (!quotation) throw new ApiError(404, "Quotation not found");

    // Verify populated data exists
    if (!quotation.project || !quotation.project.client) {
      throw new ApiError(400, "Client information not found");
    }

    // Calculate totals (though they should be pre-calculated by the pre-save hook)
    const subtotal = quotation.items.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const vatAmount = subtotal * (quotation.vatPercentage / 100);
    const netAmount = subtotal + vatAmount;

    // Format dates
    const formatDate = (date: Date) => {
      return date ? new Date(date).toLocaleDateString("en-GB") : "";
    };

    const preparedBy = quotation.preparedBy;
    // const approvedBy = quotation.approvedBy;
    const estimationId = quotation.estimation;
    const estimation = await Estimation.findById(estimationId)
      .populate("approvedBy", "firstName lastName signatureImage")
      .populate("preparedBy", "firstName lastName signatureImage");
    const approvedBy = estimation.approvedBy;
    // const approvedBy = estimation.approvedBy;
    console.log("Approved By:", approvedBy);

    // Prepare HTML content
    let htmlContent = `
    <!DOCTYPE html PUBLIC "">
    <html xmlns="" xml:lang="en" lang="en">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title></title>
        <style type="text/css">
          * {
            margin: 0;
            padding: 0;
            text-indent: 0;
          }
          .s1 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: bold;
            text-decoration: none;
            font-size: 11.5pt;
          }
          .s2 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: bold;
            text-decoration: none;
            font-size: 10.5pt;
          }
          .s3 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: normal;
            text-decoration: none;
            font-size: 10pt;
          }
          .s4 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: bold;
            text-decoration: none;
            font-size: 10pt;
          }
          .s5 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: normal;
            text-decoration: none;
            font-size: 10.5pt;
          }
          .s6 {
            color: black;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: normal;
            text-decoration: none;
            font-size: 11.5pt;
          }
          .s7 {
            color: #0562c1;
            font-family: Cambria, serif;
            font-style: normal;
            font-weight: normal;
            text-decoration: underline;
            font-size: 10.5pt;
          }
          table,
          tbody {
            vertical-align: top;
            overflow: visible;
          }
        </style>
      </head>
      <body>
        <table style="border-collapse: collapse; margin-left: 6.425pt" cellspacing="0">
          <tr style="height: 126pt">
            <td style="width: 560pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 2pt;  border-top-style: solid;
            border-top-width: 2pt;" colspan="7">
              <p style="text-indent: 0pt; text-align: left">
                <span><table border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <img src="https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo.png" alt="" style="width:100%" />
                    </tr>
                  </table></span>
              </p>
              <p class="s1" style="padding-left: 2pt; text-indent: 0pt; line-height: 13pt; text-align: center;">
                QUOTATION
              </p>
            </td>
          </tr>
          <tr style="height: 13pt">
            <td style="width: 367pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 1pt;" colspan="5">
              <p class="s2" style="padding-left: 2pt; text-indent: 0pt; line-height: 12pt; text-align: center;">
                Name/Address
              </p>
            </td>
            <td style="width: 63pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 1pt;">
              <p class="s2" style="padding-left: 3pt; text-indent: 0pt; line-height: 12pt; text-align: center;">
                Date
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 2pt;">
              <p class="s2" style="padding-left: 3pt; text-indent: 0pt; line-height: 12pt; text-align: center;">
                Quotation#
              </p>
            </td>
          </tr>
          <tr style="height: 50pt">
            <td style="width: 367pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 2pt;" colspan="5" rowspan="2">
              <p class="s2" style="padding-left: 1pt; text-indent: 0pt; line-height: 12pt; text-align: left;">
                ${quotation.project.client.clientName || "N/A"}
              </p>
              <p class="s2" style="padding-top: 1pt; padding-left: 1pt; text-indent: 0pt; text-align: left;">
                ${quotation.project.client.clientAddress || "N/A"}
              </p>
              <p class="s2" style="padding-top: 1pt; padding-left: 1pt; text-indent: 0pt; text-align: left;">
                Tel : ${
                  quotation.project.client.mobileNumber ||
                  quotation.project.client.telephoneNumber ||
                  "N/A"
                }
              </p>
              <p class="s2" style="padding-top: 1pt; padding-left: 1pt; text-indent: 0pt; text-align: left;">
                Email: ${quotation.project.client.email || "N/A"}
              </p>
              <p class="s2" style="padding-top: 1pt; padding-left: 1pt; text-indent: 0pt; text-align: left;">
                Site: ${quotation.project.siteAddress || "N/A"}
              </p>
            </td>
            <td style="width: 63pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
              <p style="padding-top: 6pt; text-indent: 0pt; text-align: left"><br /></p>
              <p class="s2" style="padding-left: 2pt; text-indent: 0pt; text-align: center">
                ${formatDate(quotation.date)}
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p style="padding-top: 6pt; text-indent: 0pt; text-align: left"><br /></p>
              <p class="s2" style="padding-left: 3pt; padding-right: 1pt; text-indent: 0pt; text-align: center;">
                ${quotation.quotationNumber}
              </p>
            </td>
          </tr>
          <tr style="height: 23pt">
            <td style="width: 63pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
              <p class="s2" style="padding-top: 4pt; padding-left: 2pt; text-indent: 0pt; text-align: center;">
                VALIDITY
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p class="s2" style="padding-top: 4pt; padding-left: 3pt; text-indent: 0pt; text-align: center;">
                ${formatDate(quotation.validUntil)}
              </p>
            </td>
          </tr>
          <tr style="height: 42pt">
            <td style="width: 560pt; border-top-style: solid; border-top-width: 2pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;" colspan="7">
              <p class="s2" style="padding-top: 7pt; padding-left: 1pt; text-indent: 2pt; line-height: 107%; text-align: left;">
                SUB: <span class="s3">${
                  quotation.project.projectName || "N/A"
                }</span>
              </p>
            </td>
          </tr>
          <tr style="height: 19pt">
  <td style="width: 30pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; padding-left: 2pt; text-indent: 0pt; text-align: center;">
      SL.NO
    </p>
  </td>
  <td style="width: 180pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; padding-left: 2pt; text-indent: 0pt; text-align: center;">
      DESCRIPTION
    </p>
  </td>
  <td style="width: 30pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; text-indent: 0pt; text-align: center;">
      UOM
    </p>
  </td>
  <td style="width: 50pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; text-indent: 0pt; text-align: center;">
      IMAGE
    </p>
  </td>
  <td style="width: 40pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; text-indent: 0pt; text-align: center;">
      QTY
    </p>
  </td>
  <td style="width: 50pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s4" style="padding-top: 3pt; text-indent: 0pt; text-align: center;">
      UNIT PRICE
    </p>
  </td>
  <td style="width: 60pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
    <p class="s4" style="padding-top: 3pt; text-indent: 0pt; text-align: center;">
      TOTAL
    </p>
  </td>
</tr>

${quotation.items
  .map(
    (item, index) => `
<tr style="height: 50pt">
  <td style="width: 30pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s5" style="padding-top: 6pt; text-indent: 0pt; text-align: center">
      ${index + 1}
    </p>
  </td>
  <td style="width: 180pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s5" style="padding-top: 6pt; padding-left: 2pt; text-indent: 0pt; text-align: left">
      ${item.description}
    </p>
  </td>
  <td style="width: 30pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s5" style="padding-top: 6pt; text-indent: 0pt; text-align: center">
      ${item.uom || "NOS"}
    </p>
  </td>
  <td style="width: 50pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <div style="width: 40pt; height: 40pt; display: flex; align-items: center; justify-content: center; margin: 0 auto;">
      ${
        item.image?.url
          ? `<img src="${item.image.url}" style="max-width: 100%; max-height: 100%; object-fit: contain;"/>`
          : ""
      }
    </div>
  </td>
  <td style="width: 40pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s5" style="padding-top: 6pt; text-indent: 0pt; text-align: center">
      ${item.quantity.toFixed(2)}
    </p>
  </td>
  <td style="width: 50pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
    <p class="s5" style="padding-top: 6pt; text-indent: 0pt; text-align: center">
      ${item.unitPrice.toFixed(2)}
    </p>
  </td>
  <td style="width: 60pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
    <p class="s2" style="padding-top: 6pt; text-indent: 0pt; text-align: center">
      ${item.totalPrice.toFixed(2)}
    </p>
  </td>
</tr>
`
  )
  .join("")}
          <tr style="height: 19pt">
            <td style="width: 430pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="6">
              <p class="s2" style="padding-top: 2pt; padding-right: 8pt; text-indent: 0pt; text-align: right;">
                TOTAL AMOUNT
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p class="s2" style="padding-top: 3pt; padding-left: 3pt; text-indent: 0pt; text-align: center;">
                ${subtotal.toFixed(2)}
              </p>
            </td>
          </tr>
          <tr style="height: 19pt">
            <td style="width: 430pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan=6">
              <p class="s2" style="padding-top: 2pt; padding-right: 8pt; text-indent: 0pt; text-align: right;">
                VAT ${quotation.vatPercentage}%
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p class="s2" style="padding-top: 3pt; padding-left: 3pt; text-indent: 0pt; text-align: center;">
                ${vatAmount.toFixed(2)}
              </p>
            </td>
          </tr>
          <tr style="height: 19pt">
            <td style="width: 430pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="6">
              <p style="text-indent: 0pt; text-align: left">
                <span><table border="0" cellspacing="0" cellpadding="0"></table></span>
              </p>
              <p class="s2" style="padding-top: 2pt; padding-right: 8pt; text-indent: 0pt; text-align: right;">
                NET AMOUNT
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p class="s2" style="padding-top: 3pt; padding-left: 3pt; text-indent: 0pt; text-align: center;">
                ${netAmount.toFixed(2)}
              </p>
            </td>
          </tr>
          ${quotation.termsAndConditions
            .map(
              (term, index) => `
            <tr style="height: 17pt">
              <td style="width: 560pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: ${
                index === quotation.termsAndConditions.length - 1
                  ? "2pt"
                  : "1pt"
              }; border-right-style: solid; border-right-width: 2pt;" colspan="7">
                <p class="s6" style="padding-top: 1pt; padding-left: 1pt; text-indent: 0pt; text-align: left;">
                  ${index + 1}. ${term}
                </p>
              </td>
            </tr>
          `
            )
            .join("")}
          <tr style="height: 13pt">
            <td style="width: 309pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="4">
              <p class="s4" style="padding-left: 1pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                FOR AL GHAZAL AL ABYAD TECHNICAL SERVICES
              </p>
            </td>
            <td style="width: 121pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 1pt;" colspan="2" rowspan="6">
              <img src="https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/seal.png" alt="" style="width: 100%; height: auto;">
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p style="text-indent: 0pt; text-align: left"><br /></p>
            </td>
          </tr>
          <tr style="height: 13pt">
            <td style="width: 102pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="3">
              <p class="s4" style="padding-left: 1pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                Prepared by
              </p>
            </td>
            <td style="width: 207pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;">
              <p class="s2" style="padding-left: 2pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                ${preparedBy?.firstName || "N/A"} ${preparedBy?.lastName || ""}
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;" rowspan="3">
              <p style="text-indent: 0pt; text-align: left"><br /></p>
              <p style="padding-left: 46pt; text-indent: 0pt; text-align: left">
                <span><table border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td>
                        ${
                          approvedBy?.signatureImage
                            ? `
                        <img
                          width="81"
                          height="34"
                          src="${approvedBy.signatureImage}"
                        />`
                            : ""
                        }
                      </td>
                    </tr></table>
                </span>
              </p>
            </td>
          </tr>
          <tr style="height: 13pt">
            <td style="width: 309pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="4">
              <p class="s4" style="padding-left: 1pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                CONTACT: 044102555 / Mob.No: 0588475758
              </p>
            </td>
          </tr>
          <tr style="height: 13pt">
            <td style="width: 309pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="4">
              <p class="s4" style="padding-left: 1pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                Shop No:04,R09-France Cluster,International City-Dubai
              </p>
            </td>
          </tr>
          <tr style="height: 13pt">
            <td style="width: 309pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 1pt;" colspan="4">
              <p class="s4" style="padding-left: 1pt; text-indent: 0pt; line-height: 11pt; text-align: left;">
                P.O.Box:262760,Dubai-U.A.E
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 1pt; border-right-style: solid; border-right-width: 2pt;">
              <p style="text-indent: 0pt; text-align: left"><br /></p>
            </td>
          </tr>
          <tr style="height: 15pt">
            <td style="width: 309pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 2pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 1pt;" colspan="4">
              <p style="padding-left: 1pt; text-indent: 0pt; line-height: 12pt; text-align: left;">
                <a href="http://www.alghazalgroup.com/" class="s7">www.alghazalgroup.com</a>
              </p>
            </td>
            <td style="width: 130pt; border-top-style: solid; border-top-width: 1pt; border-left-style: solid; border-left-width: 1pt; border-bottom-style: solid; border-bottom-width: 2pt; border-right-style: solid; border-right-width: 2pt;">
              <p style="text-indent: 0pt; text-align: left"><br /></p>
            </td>
          </tr>
        </table>
      </body>
    </html>
    `;

    // Generate PDF
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();

      await page.setViewport({
        width: 1200,
        height: 1800,
        deviceScaleFactor: 1,
      });

      await page.setContent(htmlContent, {
        waitUntil: ["load", "networkidle0", "domcontentloaded"],
        timeout: 30000,
      });

      // Additional wait for dynamic content
      await page.waitForSelector("body", { timeout: 5000 });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "0.5in",
          right: "0.5in",
          bottom: "0.5in",
          left: "0.5in",
        },
        preferCSSPageSize: true,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=quotation-${quotation.quotationNumber}.pdf`
      );
      res.send(pdfBuffer);
    } finally {
      await browser.close();
    }
  }
);
