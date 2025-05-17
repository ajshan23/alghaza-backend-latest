import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { IProject, Project } from "../models/projectModel";
import { Client } from "../models/clientModel";
import { Estimation } from "../models/estimationModel";
import { User } from "@/models/userModel";
import { Quotation } from "../models/quotationModel";
import { mailer } from "../utils/mailer";
import { Comment } from "../models/commentModel";
import { LPO } from "../models/lpoModel";
import dayjs from "dayjs";
import { Types } from "mongoose";
import { generateProjectNumber } from "../utils/documentNumbers";
import { WorkProgressTemplateParams } from "@/template/workProgressEmailTemplate";

// Status transition validation
const validStatusTransitions: Record<string, string[]> = {
  draft: ["estimation_prepared"],
  estimation_prepared: ["quotation_sent", "on_hold", "cancelled"],
  quotation_sent: [
    "quotation_approved",
    "quotation_rejected",
    "on_hold",
    "cancelled",
  ],
  quotation_approved: ["lpo_received", "on_hold", "cancelled"],
  lpo_received: ["work_started", "on_hold", "cancelled"],
  work_started: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["work_completed", "on_hold", "cancelled"],
  work_completed: ["quality_check", "on_hold"],
  quality_check: ["client_handover", "work_completed"],
  client_handover: ["final_invoice_sent", "on_hold"],
  final_invoice_sent: ["payment_received", "on_hold"],
  payment_received: ["project_closed"],
  on_hold: ["in_progress", "work_started", "cancelled"],
  cancelled: [],
  project_closed: [],
  lpo_received: ["team_assigned", "on_hold", "cancelled"],
  team_assigned: ["work_started", "on_hold"],
  work_started: ["in_progress", "on_hold", "cancelled"],
};

export const createProject = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      projectName,
      projectDescription,
      client,
      location,
      building,
      apartmentNumber,
    } = req.body;
    console.log(req.body);

    if (!projectName || !client || !location || !building || !apartmentNumber) {
      throw new ApiError(400, "Required fields are missing");
    }

    const clientExists = await Client.findById(client);
    if (!clientExists) {
      throw new ApiError(404, "Client not found");
    }

    const project = await Project.create({
      projectName,
      projectDescription,
      client,
      location,
      building,
      apartmentNumber,
      projectNumber: await generateProjectNumber(),
      status: "draft",
      progress: 0,
      createdBy: req.user?.userId,
    });

    res
      .status(201)
      .json(new ApiResponse(201, project, "Project created successfully"));
  }
);

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  // Build filter
  const filter: any = {};

  // Status filter
  if (req.query.status) {
    filter.status = req.query.status;
  }

  // Client filter
  if (req.query.client) {
    filter.client = req.query.client;
  }

  // Search functionality
  if (req.query.search) {
    const searchTerm = req.query.search as string;
    filter.$or = [
      { projectName: { $regex: searchTerm, $options: "i" } },
      { projectDescription: { $regex: searchTerm, $options: "i" } },
      { location: { $regex: searchTerm, $options: "i" } },
      { building: { $regex: searchTerm, $options: "i" } },
      { apartmentNumber: { $regex: searchTerm, $options: "i" } },
      { projectNumber: { $regex: searchTerm, $options: "i" } }, // Added projectNumber to search
    ];
  }

  const total = await Project.countDocuments(filter);

  const projects = await Project.find(filter)
    .populate("client", "clientName clientAddress mobileNumber")
    .populate("createdBy", "firstName lastName email")
    .populate("updatedBy", "firstName lastName email")
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        projects,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      },
      "Projects retrieved successfully"
    )
  );
});

export const getEngineerProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    // Validate engineer user
    if (!userId) {
      throw new ApiError(401, "Unauthorized access");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter - only projects assigned to this engineer
    const filter: any = { assignedTo: userId };

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Client filter
    if (req.query.client) {
      filter.client = req.query.client;
    }

    // Search functionality
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      filter.$or = [
        { projectName: { $regex: searchTerm, $options: "i" } },
        { projectDescription: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        { building: { $regex: searchTerm, $options: "i" } },
        { apartmentNumber: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .populate("client", "clientName clientAddress mobileNumber")
      .populate("createdBy", "firstName lastName email")
      .populate("updatedBy", "firstName lastName email")
      .populate("assignedTo", "firstName lastName email")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          projects,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        },
        "Projects retrieved successfully"
      )
    );
  }
);

export const getProject = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const project = await Project.findById(id)
    .populate("client")
    .populate("createdBy", "firstName lastName email")
    .populate("updatedBy", "firstName lastName email")
    .populate("assignedTo", "-password");

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  // Check if an estimation exists for this project
  const estimation = await Estimation.findOne({ project: id }).select(
    "_id isChecked isApproved"
  );
  const quotation = await Quotation.findOne({ project: id }).select("_id");
  const Lpo = await LPO.findOne({ project: id }).select("_id");

  const responseData = {
    ...project.toObject(),
    estimationId: estimation?._id || null,
    quotationId: quotation?._id || null,
    lpoId: Lpo?._id || null,
    isChecked: estimation?.isChecked || false,
    isApproved: estimation?.isApproved || false,
  };

  res
    .status(200)
    .json(new ApiResponse(200, responseData, "Project retrieved successfully"));
});

export const updateProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const updateData = req.body;
    console.log(updateData);

    // Add updatedBy automatically
    updateData.updatedBy = req.user?.userId;

    const project = await Project.findById(id);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Validate progress (0-100)
    if (updateData.progress !== undefined) {
      if (updateData.progress < 0 || updateData.progress > 100) {
        throw new ApiError(400, "Progress must be between 0 and 100");
      }
    }

    // Update status with validation
    if (updateData.status) {
      if (
        !validStatusTransitions[project.status]?.includes(updateData.status)
      ) {
        throw new ApiError(
          400,
          `Invalid status transition from ${project.status} to ${updateData.status}`
        );
      }
    }

    const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("client", "clientName clientAddress mobileNumber")
      .populate("updatedBy", "firstName lastName email");

    res
      .status(200)
      .json(
        new ApiResponse(200, updatedProject, "Project updated successfully")
      );
  }
);

export const updateProjectStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      throw new ApiError(400, "Status is required");
    }

    const project = await Project.findById(id);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Validate status transition
    if (!validStatusTransitions[project.status]?.includes(status)) {
      throw new ApiError(
        400,
        `Invalid status transition from ${project.status} to ${status}`
      );
    }

    const updateData: any = {
      status,
      updatedBy: req.user?.userId,
    };

    const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedProject,
          "Project status updated successfully"
        )
      );
  }
);

export const assignProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { assignedTo } = req.body;

    // Validation
    if (!assignedTo || !id) {
      throw new ApiError(400, "AssignedTo is required");
    }

    // Find project
    const project = await Project.findById(id);
    if (!project) {
      throw new ApiError(400, "Project not found");
    }

    // Find engineer
    const engineer = await User.findById(assignedTo);
    if (!engineer) {
      throw new ApiError(400, "Engineer not found");
    }

    // Update project assignment
    project.assignedTo = assignedTo;
    await project.save();

    try {
      // Get all admin and super_admin users
      const adminUsers = await User.find({
        role: { $in: ["admin", "super_admin"] },
        email: { $exists: true, $ne: "" }, // Only users with emails
      }).select("email firstName");

      // Create list of all recipients (engineer + admins)
      const allRecipients = [
        engineer.email,
        ...adminUsers.map((admin) => admin.email),
      ];

      // Remove duplicates (in case engineer is also an admin)
      const uniqueRecipients = [...new Set(allRecipients)];

      // Send single email to all recipients
      await mailer.sendEmail({
        to: uniqueRecipients.join(","), // Comma-separated list
        subject: `Project Assignment: ${project.projectName}`,
        templateParams: {
          userName: "Team", // Generic since we're sending to multiple people
          actionUrl: `http://localhost:5173/app/project-view/${project._id}`,
          contactEmail: "propertymanagement@alhamra.ae",
          logoUrl:
            "https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo+alghazal.png",
          projectName: project.projectName || "the project",
        },
        text: `Dear Team,\n\nEngineer ${
          engineer.firstName || "Engineer"
        } has been assigned to project "${
          project.projectName || "the project"
        }".\n\nView project details: http://localhost:5173/app/project-view/${
          project._id
        }\n\nBest regards,\nTECHNICAL SERVICE TEAM`,
        headers: {
          "X-Priority": "1",
          Importance: "high",
        },
      });

      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {},
            "Project assigned and notifications sent successfully"
          )
        );
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            {},
            "Project assigned successfully but notification emails failed to send"
          )
        );
    }
  }
);

export const updateProjectProgress = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { progress, comment } = req.body;
    const userId = req.user?.userId;

    if (progress === undefined || progress < 0 || progress > 100) {
      throw new ApiError(400, "Progress must be between 0 and 100");
    }

    const project = await Project.findById(id).populate("assignedTo client");
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Store old progress for comparison
    const oldProgress = project.progress;

    // Update project status based on progress
    if (project.progress >= 0 && project.status === "team_assigned") {
      project.status = "work_started";
    }
    if (project.progress > 0 && project.status === "work_started") {
      project.status = "in_progress";
    }

    const updateData: any = {
      progress,
      updatedBy: userId,
    };

    // Auto-update status if progress reaches 100%
    if (progress === 100 && project.status !== "work_completed") {
      updateData.status = "work_completed";
    }

    await project.save(); // Save the project first to update its status
    const updatedProject = await Project.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    // Create a progress update comment
    if (comment || progress !== oldProgress) {
      const commentContent =
        comment || `Progress updated from ${oldProgress}% to ${progress}%`;

      await Comment.create({
        content: commentContent,
        user: userId,
        project: id,
        actionType: "progress_update",
        progress: progress,
      });
    }

    // Send progress update email if progress changed
    if (progress !== oldProgress) {
      try {
        // Get all recipients (client + assigned engineer + admins + super_admins)
        const recipients = [];

        // Add client if exists
        if (project.client?.email) {
          recipients.push({
            email: project.client.email,
            name: project.client.firstName || "Client",
          });
        }

        // Add assigned engineer if exists
        if (project.assignedTo?.email) {
          recipients.push({
            email: project.assignedTo.email,
            name: project.assignedTo.firstName || "Engineer",
          });
        }

        // Add admins and super admins
        const admins = await User.find({
          role: { $in: ["admin", "super_admin"] },
          email: { $exists: true, $ne: "" },
        });
        admins.forEach((admin) => {
          recipients.push({
            email: admin.email,
            name: admin.firstName || "Admin",
          });
        });

        // Remove duplicates
        const uniqueRecipients = recipients.filter(
          (recipient, index, self) =>
            index === self.findIndex((r) => r.email === recipient.email)
        );

        // Get the user who updated the progress
        const updatedByUser = await User.findById(userId);

        // Prepare email content
        const templateParams: WorkProgressTemplateParams = {
          userName: "Team",
          projectName: project.projectName,
          progress: progress,
          progressDetails: comment,
          contactEmail: "propertymanagement@alhamra.ae",
          logoUrl:
            "https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo+alghazal.png",
          actionUrl: `http://localhost:5173/app/project-view/${project._id}`,
        };

        // Send email to all recipients
        await mailer.sendEmail({
          to: process.env.NOTIFICATION_INBOX || "notifications@company.com",
          bcc: uniqueRecipients.map((r) => r.email).join(","),
          subject: `Progress Update: ${project.projectName} (${progress}% Complete)`,
          templateParams,
          text: `Dear Team,\n\nThe progress for project ${
            project.projectName
          } has been updated to ${progress}%.\n\n${
            comment ? `Details: ${comment}\n\n` : ""
          }View project: ${
            templateParams.actionUrl
          }\n\nBest regards,\nTECHNICAL SERVICE TEAM`,
          headers: {
            "X-Priority": "1",
            Importance: "high",
          },
        });
      } catch (emailError) {
        console.error("Failed to send progress update emails:", emailError);
        // Continue even if email fails
      }
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedProject,
          "Project progress updated successfully"
        )
      );
  }
);
export const getProjectProgressUpdates = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const progressUpdates = await Comment.find({
      project: projectId,
      actionType: "progress_update",
    })
      .populate("user", "firstName lastName profileImage")
      .sort({ createdAt: -1 });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          progressUpdates,
          "Project progress updates retrieved successfully"
        )
      );
  }
);

export const deleteProject = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Prevent deletion if project is beyond draft stage
    if (project.status !== "draft") {
      throw new ApiError(400, "Cannot delete project that has already started");
    }

    await Project.findByIdAndDelete(id);

    res
      .status(200)
      .json(new ApiResponse(200, null, "Project deleted successfully"));
  }
);
export const generateInvoiceData = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    // Validate projectId
    if (!projectId || !Types.ObjectId.isValid(projectId)) {
      throw new ApiError(400, "Valid project ID is required");
    }

    // Get project data with more strict validation
    const project = await Project.findById(projectId)
      .populate(
        "client",
        "clientName clientAddress mobileNumber contactPerson trnNumber"
      )
      .populate("createdBy", "firstName lastName")
      .populate("assignedTo", "firstName lastName")
      .lean();

    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    // Get quotation data with validation
    const quotation = await Quotation.findOne({ project: projectId }).lean();
    if (!quotation) {
      throw new ApiError(404, "Quotation not found for this project");
    }

    // Get LPO data with validation
    const lpo = await LPO.findOne({ project: projectId }).lean();
    if (!lpo) {
      throw new ApiError(404, "LPO not found for this project");
    }

    // Validate required fields
    if (!quotation.items || quotation.items.length === 0) {
      throw new ApiError(400, "Quotation items are required");
    }

    // Generate invoice number with better format
    const invoiceNumber = `INV-${dayjs().year()}${String(
      dayjs().month() + 1
    ).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Enhanced vendee information
    const vendeeInfo = {
      name: project.client.clientName || "IMDAAD LLC",
      contactPerson: project.assignedTo
        ? `Mr. ${project.assignedTo.firstName} ${project.assignedTo.lastName}`
        : project.client.contactPerson || "N/A",
      poBox: project.client.pincode || "18220",
      address: project.client.clientAddress || "DUBAI - UAE",
      phone: project.client.mobileNumber || "(04) 812 8888",
      fax: "(04) 881 8405",
      trn: project.client.trnNumber || "100236819700003",
      grnNumber: lpo.lpoNumber || "N/A",
      supplierNumber: "PO25IMD7595",
      servicePeriod: `${dayjs(project.createdAt).format(
        "DD-MM-YYYY"
      )} to ${dayjs().format("DD-MM-YYYY")}`,
    };

    // Enhanced vendor information
    const vendorInfo = {
      name: "AL GHAZAL AL ABYAD TECHNICAL SERVICES",
      poBox: "63509",
      address: "Dubai - UAE",
      phone: "(04) 4102555",
      fax: "",
      trn: "104037793700003",
    };

    // Enhanced products array
    const products = quotation.items.map((item, index) => ({
      sno: index + 1,
      description: item.description || "N/A",
      qty: item.quantity || 0,
      unitPrice: item.unitPrice || 0,
      total: item.totalPrice || 0,
    }));

    // Enhanced response structure
    const response = {
      _id: project._id.toString(),
      invoiceNumber,
      date: new Date().toISOString(),
      orderNumber: lpo.lpoNumber || "N/A",
      vendor: vendorInfo,
      vendee: vendeeInfo,
      subject: quotation.scopeOfWork?.join(", ") || "N/A",
      paymentTerms: "90 DAYS",
      amountInWords: convertToWords(quotation.netAmount || 0),
      products,
      summary: {
        amount: quotation.subtotal || 0,
        vat: quotation.vatAmount || 0,
        totalReceivable: quotation.netAmount || 0,
      },
      preparedBy: {
        _id: project.createdBy._id.toString(),
        firstName: project.createdBy.firstName,
        lastName: project.createdBy.lastName,
      },
    };

    res
      .status(200)
      .json(
        new ApiResponse(200, response, "Invoice data generated successfully")
      );
  }
);

// Enhanced number to words conversion
const convertToWords = (num: number): string => {
  const units = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
  ];
  const teens = [
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = [
    "",
    "ten",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];

  if (num === 0) return "Zero UAE Dirhams";

  let words = "";
  // Implementation of number conversion logic here...
  // (Add your full number-to-words implementation)

  return `${words} UAE Dirhams`;
};

// Add to projectController.ts
export const assignTeamAndDriver = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { workers, driverId } = req.body;

    // Validation
    if (!Array.isArray(workers) || workers.length === 0 || !driverId) {
      throw new ApiError(400, "Both workers array and driverId are required");
    }

    const project = await Project.findById(projectId);
    if (!project) throw new ApiError(404, "Project not found");

    // Verify project is in correct state
    if (project.status !== "lpo_received") {
      throw new ApiError(400, "Project must be in 'lpo_received' status");
    }

    // Verify all workers are engineers
    const validWorkers = await User.find({
      _id: { $in: workers },
      role: "worker",
    });
    if (validWorkers.length !== workers.length) {
      throw new ApiError(400, "All workers must be engineers");
    }

    // Verify driver exists
    const driver = await User.findOne({
      _id: driverId,
      role: "driver",
    });
    if (!driver) {
      throw new ApiError(400, "Valid driver ID is required");
    }

    // Update project
    project.assignedWorkers = workers;
    project.assignedDriver = driverId;
    project.status = "team_assigned";
    project.updatedBy = req.user?.userId;
    await project.save();

    // Send notifications (implementation depends on your mailer service)
    // await sendAssignmentNotifications(project, workers, driverId);

    res
      .status(200)
      .json(
        new ApiResponse(200, project, "Team and driver assigned successfully")
      );
  }
);

// Helper function for notifications
// const sendAssignmentNotifications = async (
//   project: IProject,
//   workerIds: Types.ObjectId[],
//   driverId: Types.ObjectId
// ) => {
//   try {
//     // Get all involved users (workers + driver + admins)
//     const usersToNotify = await User.find({
//       $or: [
//         { _id: { $in: workerIds } },
//         { _id: driverId },
//         { role: { $in: ["admin", "super_admin"] } },
//       ],
//     });

//     // Send emails
//     await mailer.sendEmail({
//       to: usersToNotify.map((u) => u.email).join(","),
//       subject: `Team Assigned: ${project.projectName}`,
//       templateParams: {
//         projectName: project.projectName,
//         actionUrl: `http://yourfrontend.com/projects/${project._id}`,
//       },
//       text: `You've been assigned to project ${project.projectName}`,
//     });
//   } catch (error) {
//     console.error("Notification error:", error);
//   }
// };
export const getAssignedTeam = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate("assignedWorkers", "firstName lastName profileImage")
      .populate("assignedDriver", "firstName lastName profileImage");

    if (!project) throw new ApiError(404, "Project not found");

    res.status(200).json(
      new ApiResponse(
        200,
        {
          workers: project.assignedWorkers,
          driver: project.assignedDriver,
        },
        "Assigned team fetched successfully"
      )
    );
  }
);

export const getDriverProjects = asyncHandler(
  async (req: Request, res: Response) => {
    const driverId = req.user?.userId;

    if (!driverId) {
      throw new ApiError(401, "Unauthorized access");
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build filter - only projects assigned to this driver
    const filter: any = { assignedDriver: driverId };

    // Status filter
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // Search functionality
    if (req.query.search) {
      const searchTerm = req.query.search as string;
      filter.$or = [
        { projectName: { $regex: searchTerm, $options: "i" } },
        { projectDescription: { $regex: searchTerm, $options: "i" } },
        { location: { $regex: searchTerm, $options: "i" } },
        { building: { $regex: searchTerm, $options: "i" } },
        { apartmentNumber: { $regex: searchTerm, $options: "i" } },
        { projectNumber: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const total = await Project.countDocuments(filter);

    const projects = await Project.find(filter)
      .populate("client", "clientName clientAddress mobileNumber")
      .populate("assignedWorkers", "firstName lastName profileImage")
      .populate("assignedDriver", "firstName lastName profileImage")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          projects,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        },
        "Driver projects retrieved successfully"
      )
    );
  }
);
