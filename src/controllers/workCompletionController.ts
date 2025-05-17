import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { WorkCompletion } from "../models/workCompletionModel";
import { Project } from "../models/projectModel";
import {
  uploadWorkCompletionImagesToS3,
  deleteFileFromS3,
} from "../utils/uploadConf";
import { Client } from "../models/clientModel";
import { LPO } from "../models/lpoModel";
import { generateRelatedDocumentNumber } from "../utils/documentNumbers";

export const createWorkCompletion = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.body;

    if (!projectId) {
      throw new ApiError(400, "Project ID is required");
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }
    const workCompletion = await WorkCompletion.create({
      project: projectId,
      completionNumber: await generateRelatedDocumentNumber(projectId, "WCP"),
      createdBy: req.user?.userId,
    });

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          workCompletion,
          "Work completion created successfully"
        )
      );
  }
);

export const uploadWorkCompletionImages = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const files = req.files as Express.Multer.File[];
    const { titles = [], descriptions = [] } = req.body;

    // Validation
    if (!projectId) {
      throw new ApiError(400, "Project ID is required");
    }

    if (!files || files.length === 0) {
      throw new ApiError(400, "No images uploaded");
    }

    // Convert titles to array if it's a string (for single file upload)
    const titlesArray = Array.isArray(titles) ? titles : [titles];
    const descriptionsArray = Array.isArray(descriptions)
      ? descriptions
      : [descriptions];

    // Validate titles
    if (titlesArray.length !== files.length) {
      throw new ApiError(400, "Number of titles must match number of images");
    }

    if (
      titlesArray.some(
        (title) => !title || typeof title !== "string" || !title.trim()
      )
    ) {
      throw new ApiError(400, "All images must have a non-empty title");
    }

    // Find or create work completion record
    let workCompletion = await WorkCompletion.findOne({ project: projectId });

    if (!workCompletion) {
      workCompletion = await WorkCompletion.create({
        project: projectId,
        createdBy: req.user?.userId,
      });
    } else if (workCompletion.createdBy.toString() !== req.user?.userId) {
      throw new ApiError(403, "Not authorized to update this work completion");
    }

    const uploadResults = await uploadWorkCompletionImagesToS3(files);

    if (!uploadResults.success || !uploadResults.uploadData) {
      throw new ApiError(500, "Failed to upload images to S3");
    }

    const newImages = files.map((file, index) => ({
      title: titlesArray[index],
      imageUrl: uploadResults.uploadData[index].url,
      s3Key: uploadResults.uploadData[index].key,
      description: descriptionsArray[index] || "",
    }));

    workCompletion.images.push(...newImages);
    await workCompletion.save();

    res
      .status(200)
      .json(
        new ApiResponse(200, workCompletion, "Images uploaded successfully")
      );
  }
);

export const getWorkCompletion = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, "Project ID is required");
    }

    const workCompletion = await WorkCompletion.findOne({ project: projectId })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    if (!workCompletion) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            null,
            "No work completion found for this project"
          )
        );
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          workCompletion,
          "Work completion retrieved successfully"
        )
      );
  }
);

export const deleteWorkCompletionImage = asyncHandler(
  async (req: Request, res: Response) => {
    const { workCompletionId, imageId } = req.params;

    if (!workCompletionId || !imageId) {
      throw new ApiError(400, "Work completion ID and image ID are required");
    }

    const workCompletion = await WorkCompletion.findById(workCompletionId);
    if (!workCompletion) {
      throw new ApiError(404, "Work completion not found");
    }

    if (workCompletion.createdBy.toString() !== req.user?.userId) {
      throw new ApiError(403, "Not authorized to modify this work completion");
    }

    const imageIndex = workCompletion.images.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1) {
      throw new ApiError(404, "Image not found");
    }

    const imageToDelete = workCompletion.images[imageIndex];
    const deleteResult = await deleteFileFromS3(imageToDelete.s3Key);

    if (!deleteResult.success) {
      throw new ApiError(500, "Failed to delete image from S3");
    }

    workCompletion.images.splice(imageIndex, 1);
    await workCompletion.save();

    res
      .status(200)
      .json(new ApiResponse(200, workCompletion, "Image deleted successfully"));
  }
);

export const getProjectWorkCompletionImages = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, "Project ID is required");
    }

    const workCompletion = await WorkCompletion.findOne({ project: projectId })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    if (!workCompletion) {
      return res
        .status(200)
        .json(new ApiResponse(200, [], "No work completion images found"));
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          workCompletion.images,
          "Work completion images retrieved successfully"
        )
      );
  }
);

export const getCompletionData = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ApiError(400, "Project ID is required");
    }

    // Get project details
    const project = await Project.findById(projectId)
      .populate("client", "clientName ")
      .populate("assignedTo", "firstName lastName")
      .populate("createdBy", "firstName lastName");

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Get client details
    const client = await Client.findById(project.client);
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    // Get LPO details (most recent one)
    const lpo = await LPO.findOne({ project: projectId })
      .sort({ createdAt: -1 })
      .limit(1);

    // Get work completion images
    const workCompletion = await WorkCompletion.findOne({ project: projectId })
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Construct the response object
    const responseData = {
      _id: project._id.toString(),
      referenceNumber: `COMP-${project._id.toString().slice(-6).toUpperCase()}`,
      fmContractor: "Al Ghazal Al Abyad Technical Services", // Hardcoded as per frontend
      subContractor: client.clientName,
      projectDescription:
        project.projectDescription || "No description provided",
      location: `${project.siteAddress}, ${project.siteLocation}`,
      completionDate:
        project.updatedAt?.toISOString() || new Date().toISOString(),
      lpoNumber: lpo?.lpoNumber || "Not available",
      lpoDate: lpo?.lpoDate?.toISOString() || "Not available",
      handover: {
        company: "AL GHAZAL AL ABYAD TECHNICAL SERVICES", // Hardcoded as per frontend
        name: project.assignedTo
          ? `${project.assignedTo.firstName} ${project.assignedTo.lastName}`
          : "Not assigned",
        signature: "", // Will be added later
        date: project.updatedAt?.toISOString() || new Date().toISOString(),
      },
      acceptance: {
        company: client.clientName,
        name: client.clientName, // Using client name as representative
        signature: "", // Will be added later
        date: new Date().toISOString(),
      },
      sitePictures:
        workCompletion?.images.map((img) => ({
          url: img.imageUrl,
          caption: img.title,
        })) || [],
      project: {
        _id: project._id.toString(),
        projectName: project.projectName,
      },
      preparedBy: project.createdBy,
      createdAt:
        workCompletion?.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt:
        workCompletion?.updatedAt?.toISOString() || new Date().toISOString(),
    };

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          responseData,
          "Completion data retrieved successfully"
        )
      );
  }
);
