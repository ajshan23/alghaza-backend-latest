import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { LPO } from "../models/lpoModel";
import { Project } from "../models/projectModel";
import {
  handleMultipleFileUploads,
  deleteFileFromS3,
} from "../utils/uploadConf";
import { generateRelatedDocumentNumber } from "../utils/documentNumbers";

export const createLPO = asyncHandler(async (req: Request, res: Response) => {
  const { projectId, lpoDate, supplier } = req.body;
  const files = req.files as Express.Multer.File[];

  // Parse and validate items
  let items = [];
  try {
    items = JSON.parse(req.body.items);
    if (!Array.isArray(items)) {
      throw new Error("Items must be an array");
    }
  } catch (err) {
    throw new ApiError(400, "Invalid items format - must be valid JSON array");
  }

  // Validate required fields
  if (!projectId || !lpoDate || !supplier || items.length === 0) {
    throw new ApiError(400, "All required fields must be provided");
  }

  // Validate project exists and has approved quotation
  const project = await Project.findById(projectId);
  if (!project) throw new ApiError(404, "Project not found");
  if (project.status !== "quotation_sent") {
    throw new ApiError(400, "Project must have an quotation_sent");
  }

  // Process uploaded documents
  if (!files || files.length === 0) {
    throw new ApiError(400, "At least one LPO document is required");
  }

  const uploadResult = await handleMultipleFileUploads(files);
  if (!uploadResult.success || !uploadResult.uploadData) {
    throw new ApiError(500, "Failed to upload LPO documents");
  }

  const documents = uploadResult.uploadData.map((upload, index) => ({
    url: upload.url,
    key: upload.key,
    name: files[index].originalname,
    mimetype: files[index].mimetype,
    size: files[index].size,
  }));

  // Process and validate items
  const processedItems = items.map((item: any) => {
    if (!item.description || !item.quantity || !item.unitPrice) {
      throw new ApiError(400, "All item fields are required");
    }
    return {
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.quantity) * Number(item.unitPrice),
    };
  });

  // Create LPO
  const lpo = await LPO.create({
    project: projectId,
    lpoNumber: await generateRelatedDocumentNumber(projectId, "LPO"),
    lpoDate: new Date(lpoDate),
    supplier,
    items: processedItems,
    documents,
    totalAmount: processedItems.reduce(
      (sum: any, item: any) => sum + item.totalPrice,
      0
    ),
    createdBy: req.user?.userId,
  });

  await Project.findByIdAndUpdate(projectId, { status: "lpo_received" });

  res.status(201).json(new ApiResponse(201, lpo, "LPO created successfully"));
});
// export const getLPOsByProject = asyncHandler(
//   async (req: Request, res: Response) => {
//     const { projectId } = req.params;

//     const lpos = await LPO.find({ project: projectId })
//       .populate("createdBy", "firstName lastName")
//       .sort({ lpoDate: -1 });

//     res
//       .status(200)
//       .json(new ApiResponse(200, lpos, "LPOs retrieved successfully"));
//   }
// );

export const getLPODetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const lpo = await LPO.findById(id)
      .populate("project", "projectName client")
      .populate("createdBy", "firstName lastName email");

    if (!lpo) {
      throw new ApiError(404, "LPO not found");
    }

    res.status(200).json(new ApiResponse(200, lpo, "LPO details retrieved"));
  }
);

export const deleteLPO = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const lpo = await LPO.findById(id);
  if (!lpo) throw new ApiError(404, "LPO not found");

  // Check if LPO can be deleted
  const project = await Project.findById(lpo.project);
  if (project && project.status !== "lpo_received") {
    throw new ApiError(400, "Cannot delete LPO after project has progressed");
  }

  // Delete associated files from S3
  await Promise.all(
    lpo.documents.map(async (doc) => {
      try {
        await deleteFileFromS3(doc.key);
      } catch (err) {
        console.error(`Failed to delete file ${doc.key}:`, err);
      }
    })
  );

  await LPO.findByIdAndDelete(id);

  // Revert project status if needed
  if (project) {
    await Project.findByIdAndUpdate(lpo.project, {
      status: "quotation_approved",
    });
  }

  res.status(200).json(new ApiResponse(200, null, "LPO deleted successfully"));
});

// Add this new controller method
export const getLPOsByProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Validate project exists
    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    const lpo = await LPO.findOne({ project: projectId })
      .populate("createdBy", "firstName lastName email")
      .sort({ lpoDate: -1, createdAt: -1 });
    console.log(lpo);

    res
      .status(200)
      .json(new ApiResponse(200, lpo, "LPOs retrieved successfully"));
  }
);
