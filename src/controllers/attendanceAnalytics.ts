// controllers/attendanceAnalytics.controller.ts
import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Attendance } from "../models/attendanceModel";
import { User } from "../models/userModel";
import { Project } from "../models/projectModel";
import dayjs from "dayjs";
import { Types } from "mongoose";

// 1. Dashboard Overview Stats
export const getOverviewStats = asyncHandler(
  async (req: Request, res: Response) => {
    const { period = "monthly", year = dayjs().year().toString() } = req.query;

    // Calculate date range
    const startDate = dayjs(`${year}-01-01`).startOf("year").toDate();
    const endDate = dayjs(`${year}-12-31`).endOf("year").toDate();

    // Get basic counts
    const [totalPresent, totalAbsent, totalEmployees] = await Promise.all([
      Attendance.countDocuments({
        present: true,
        date: { $gte: startDate, $lte: endDate },
      }),
      Attendance.countDocuments({
        present: false,
        date: { $gte: startDate, $lte: endDate },
      }),
      User.countDocuments({}),
    ]);

    // Monthly trend data
    const monthlyTrend = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $month: "$date" },
          present: { $sum: { $cond: [{ $eq: ["$present", true] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          month: "$_id",
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
              1,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);

    // Top/Bottom performers
    const performers = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $group: {
          _id: "$user._id",
          name: {
            $first: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          },
          present: { $sum: { $cond: [{ $eq: ["$present", true] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          employeeId: "$_id",
          name: 1,
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
              1,
            ],
          },
          _id: 0,
        },
      },
      { $sort: { attendanceRate: -1 } },
      { $limit: 10 },
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          period,
          year,
          totalEmployees,
          totalPresent,
          totalAbsent,
          overallAttendance:
            (totalPresent / (totalPresent + totalAbsent)) * 100,
          monthlyTrend,
          topPerformers: performers.slice(0, 5),
          bottomPerformers: performers.slice(-5).reverse(),
        },
        "Overview stats retrieved successfully"
      )
    );
  }
);

// 2. Employee Trend Analysis
export const getEmployeeTrend = asyncHandler(
  async (req: Request, res: Response) => {
    const { employeeId } = req.params;
    const { months = "6" } = req.query;

    // Validate employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      throw new ApiError(404, "Employee not found");
    }

    const endDate = dayjs().endOf("day").toDate();
    const startDate = dayjs()
      .subtract(Number(months), "months")
      .startOf("day")
      .toDate();

    const trendData = await Attendance.aggregate([
      {
        $match: {
          user: new Types.ObjectId(employeeId),
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          present: { $sum: { $cond: [{ $eq: ["$present", true] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          month: "$_id",
          attendanceRate: {
            $round: [
              { $multiply: [{ $divide: ["$present", "$total"] }, 100] },
              1,
            ],
          },
          presentDays: "$present",
          workingDays: "$total",
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);

    // Calculate totals
    const totals = trendData.reduce(
      (acc, curr) => {
        acc.present += curr.presentDays;
        acc.total += curr.workingDays;
        return acc;
      },
      { present: 0, total: 0 }
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          employee: {
            id: employee._id,
            name: `${employee.firstName} ${employee.lastName}`,
            position: employee.position,
          },
          months: Number(months),
          trendData,
          overallAttendance:
            totals.total > 0 ? (totals.present / totals.total) * 100 : 0,
          totalPresent: totals.present,
          totalAbsent: totals.total - totals.present,
        },
        "Employee trend data retrieved successfully"
      )
    );
  }
);

// 3. All Projects Analytics
export const getProjectAnalyticsAll = asyncHandler(
  async (req: Request, res: Response) => {
    const { period = "monthly", year = dayjs().year().toString() } = req.query;

    const projects = await Project.find().select("_id projectName");

    const projectStats = await Promise.all(
      projects.map(async (project) => {
        const stats = await Attendance.aggregate([
          {
            $match: {
              project: project._id,
              type: "project",
            },
          },
          {
            $group: {
              _id: null,
              present: { $sum: { $cond: [{ $eq: ["$present", true] }, 1, 0] } },
              total: { $sum: 1 },
            },
          },
        ]);

        return {
          projectId: project._id,
          projectName: project.projectName,
          present: stats[0]?.present || 0,
          total: stats[0]?.total || 0,
          attendanceRate: stats[0]
            ? (stats[0].present / stats[0].total) * 100
            : 0,
        };
      })
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          period,
          year,
          projectStats: projectStats.sort(
            (a, b) => b.attendanceRate - a.attendanceRate
          ),
        },
        "All projects stats retrieved successfully"
      )
    );
  }
);

// 4. Specific Project Analytics
export const getProjectAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { period = "monthly", year = dayjs().year().toString() } = req.query;

    const project = await Project.findById(projectId);
    if (!project) {
      throw new ApiError(404, "Project not found");
    }

    const analytics = await Attendance.aggregate([
      {
        $match: {
          project: new Types.ObjectId(projectId),
          type: "project",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $group: {
          _id: {
            period:
              period === "monthly"
                ? { $dateToString: { format: "%Y-%m", date: "$date" } }
                : { $dateToString: { format: "%Y-%U", date: "$date" } },
            userId: "$user._id",
            userName: {
              $first: { $concat: ["$user.firstName", " ", "$user.lastName"] },
            },
          },
          present: { $sum: { $cond: [{ $eq: ["$present", true] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.period",
          period: { $first: "$_id.period" },
          workers: {
            $push: {
              userId: "$_id.userId",
              name: "$_id.userName",
              present: "$present",
              total: "$total",
              rate: { $divide: ["$present", "$total"] },
            },
          },
          totalPresent: { $sum: "$present" },
          totalDays: { $sum: "$total" },
        },
      },
      {
        $project: {
          period: 1,
          attendanceRate: {
            $round: [
              {
                $multiply: [{ $divide: ["$totalPresent", "$totalDays"] }, 100],
              },
              1,
            ],
          },
          workers: {
            $map: {
              input: "$workers",
              as: "worker",
              in: {
                userId: "$$worker.userId",
                name: "$$worker.name",
                presentDays: "$$worker.present",
                totalDays: "$$worker.total",
                attendanceRate: {
                  $round: [{ $multiply: ["$$worker.rate", 100] }, 1],
                },
              },
            },
          },
          _id: 0,
        },
      },
      { $sort: { period: 1 } },
    ]);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          project: {
            id: project._id,
            name: project.projectName,
            startDate: project.startDate,
            endDate: project.endDate,
          },
          period,
          year,
          analytics,
        },
        "Project analytics retrieved successfully"
      )
    );
  }
);
