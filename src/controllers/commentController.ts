import { Request, Response } from "express";
import { Comment } from "../models/commentModel";
import { ApiError, ApiResponse } from "../utils/apiHandlerHelpers";
import { asyncHandler } from "../utils/asyncHandler";

export const addProjectComment = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { content } = req.body;
    const userId = req.user?.userId;

    if (!content) {
      throw new ApiError(400, "Comment content is required");
    }

    const comment = await Comment.create({
      content,
      user: userId,
      project: projectId,
      actionType: "general",
    });

    const populatedComment = await Comment.findById(comment._id).populate(
      "user",
      "firstName lastName"
    );

    res
      .status(201)
      .json(
        new ApiResponse(201, populatedComment, "Comment added successfully")
      );
  }
);

export const getProjectActivity = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const activities = await Comment.find({ project: projectId })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          activities,
          "Project activity retrieved successfully"
        )
      );
  }
);
