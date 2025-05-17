import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiResponse } from "../utils/apiHandlerHelpers";
import { ApiError } from "../utils/apiHandlerHelpers";
import { Client } from "../models/clientModel";

export const createClient = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      clientName,
      clientAddress,
      pincode,
      mobileNumber,
      telephoneNumber,
      trnNumber,
      email,
      accountNumber,
      locations,
    } = req.body;

    // Validate required fields
    if (
      !clientName ||
      !clientAddress ||
      !pincode ||
      !mobileNumber ||
      !trnNumber ||
      !email
    ) {
      throw new ApiError(
        400,
        "Client name, address, pincode, mobile number, email and TRN are required"
      );
    }

    // Check if TRN already exists
    const existingClient = await Client.findOne({ trnNumber });
    if (existingClient) {
      throw new ApiError(400, "Client with this TRN already exists");
    }

    const client = await Client.create({
      clientName,
      clientAddress,
      pincode,
      mobileNumber,
      telephoneNumber,
      trnNumber,
      email,
      accountNumber,
      locations,
      createdBy: req.user?.userId,
    });

    res
      .status(201)
      .json(new ApiResponse(201, client, "Client created successfully"));
  }
);

export const getClients = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const filter: any = {};

  // Search functionality
  if (req.query.search) {
    filter.$or = [
      { clientName: { $regex: req.query.search, $options: "i" } },
      { trnNumber: { $regex: req.query.search, $options: "i" } },
      { mobileNumber: { $regex: req.query.search, $options: "i" } },
      { pincode: { $regex: req.query.search, $options: "i" } },
      { accountNumber: { $regex: req.query.search, $options: "i" } },
    ];
  }

  // Filter by pincode if provided
  if (req.query.pincode) {
    filter.pincode = req.query.pincode;
  }

  const total = await Client.countDocuments(filter);
  const clients = await Client.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("createdBy", "firstName lastName email");

  res.status(200).json(
    new ApiResponse(
      200,
      {
        clients,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page * limit < total,
          hasPreviousPage: page > 1,
        },
      },
      "Clients retrieved successfully"
    )
  );
});

export const getClient = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const client = await Client.findById(id).populate(
    "createdBy",
    "firstName lastName email"
  );
  if (!client) {
    throw new ApiError(404, "Client not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, client, "Client retrieved successfully"));
});

export const updateClient = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      clientName,
      clientAddress,
      pincode,
      mobileNumber,
      telephoneNumber,
      trnNumber,
      email,
      accountNumber,
      locations,
    } = req.body;

    const client = await Client.findById(id);
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    // Validate pincode format if provided
    if (pincode && !/^[0-9]{6}$/.test(pincode)) {
      throw new ApiError(400, "Pincode must be 6 digits");
    }

    // Check if TRN is being updated and conflicts with other clients
    if (trnNumber && trnNumber !== client.trnNumber) {
      const existingClient = await Client.findOne({
        trnNumber,
        _id: { $ne: id },
      });

      if (existingClient) {
        throw new ApiError(400, "Another client already uses this TRN");
      }
    }

    const updatedClient = await Client.findByIdAndUpdate(
      id,
      {
        clientName: clientName || client.clientName,
        clientAddress: clientAddress || client.clientAddress,
        pincode: pincode || client.pincode,
        mobileNumber: mobileNumber || client.mobileNumber,
        telephoneNumber:
          telephoneNumber !== undefined
            ? telephoneNumber
            : client.telephoneNumber,
        trnNumber: trnNumber || client.trnNumber,
        email: email || client.email,
        accountNumber:
          accountNumber !== undefined ? accountNumber : client.accountNumber,
        locations: locations !== undefined ? locations : client.locations,
      },
      { new: true }
    );

    res
      .status(200)
      .json(new ApiResponse(200, updatedClient, "Client updated successfully"));
  }
);

export const deleteClient = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const client = await Client.findByIdAndDelete(id);
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, null, "Client deleted successfully"));
  }
);

export const getClientByTrn = asyncHandler(
  async (req: Request, res: Response) => {
    const { trnNumber } = req.params;

    const client = await Client.findOne({ trnNumber }).populate(
      "createdBy",
      "firstName lastName email"
    );
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, client, "Client retrieved successfully"));
  }
);

export const getClientsByPincode = asyncHandler(
  async (req: Request, res: Response) => {
    const { pincode } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    if (!/^[0-9]{6}$/.test(pincode)) {
      throw new ApiError(400, "Invalid pincode format");
    }

    const total = await Client.countDocuments({ pincode });
    const clients = await Client.find({ pincode })
      .skip(skip)
      .limit(limit)
      .sort({ clientName: 1 })
      .populate("createdBy", "firstName lastName email");

    res.status(200).json(
      new ApiResponse(
        200,
        {
          clients,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        },
        "Clients retrieved successfully"
      )
    );
  }
);

// Additional helper functions for locations/buildings/apartments
export const addLocationToClient = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new ApiError(400, "Location name is required");
    }

    const client = await Client.findByIdAndUpdate(
      id,
      { $push: { locations: { name } } },
      { new: true }
    );

    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    res
      .status(200)
      .json(new ApiResponse(200, client, "Location added successfully"));
  }
);

export const addBuildingToLocation = asyncHandler(
  async (req: Request, res: Response) => {
    const { clientId, locationId } = req.params;
    const { name } = req.body;

    if (!name) {
      throw new ApiError(400, "Building name is required");
    }

    const client = await Client.findById(clientId);
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    const location = client.locations.id(locationId);
    if (!location) {
      throw new ApiError(404, "Location not found");
    }

    location.buildings.push({ name, apartments: [] });
    await client.save();

    res
      .status(200)
      .json(new ApiResponse(200, client, "Building added successfully"));
  }
);

export const addApartmentToBuilding = asyncHandler(
  async (req: Request, res: Response) => {
    const { clientId, locationId, buildingId } = req.params;
    const { number } = req.body;

    if (!number) {
      throw new ApiError(400, "Apartment number is required");
    }

    const client = await Client.findById(clientId);
    if (!client) {
      throw new ApiError(404, "Client not found");
    }

    const location = client.locations.id(locationId); // Changed _id to id
    if (!location) {
      throw new ApiError(404, "Location not found");
    }

    const building = location.buildings.id(buildingId); // Changed _id to id
    if (!building) {
      throw new ApiError(404, "Building not found");
    }

    building.apartments.push({ number });
    await client.save();

    res
      .status(200)
      .json(new ApiResponse(200, client, "Apartment added successfully"));
  }
);
