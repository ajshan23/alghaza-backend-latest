import { Document, Schema, model, Types } from "mongoose";

export interface IApartment extends Document {
  number: string;
}

export interface IBuilding extends Document {
  name: string;
  apartments: IApartment[];
}

export interface ILocation extends Document {
  name: string;
  buildings: IBuilding[];
}

export interface IClient extends Document {
  clientName: string;
  clientAddress: string;
  pincode: string;
  mobileNumber: string;
  telephoneNumber?: string;
  trnNumber: string;
  email: string;
  accountNumber?: string;
  locations: ILocation[];
  createdBy: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const apartmentSchema = new Schema<IApartment>({
  number: {
    type: String,
    required: true,
    trim: true,
  },
});

const buildingSchema = new Schema<IBuilding>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  apartments: [apartmentSchema],
});

const locationSchema = new Schema<ILocation>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  buildings: [buildingSchema],
});

const clientSchema = new Schema<IClient>(
  {
    clientName: {
      type: String,
      required: true,
      trim: true,
    },
    clientAddress: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{6}$/.test(v);
        },
        message: (props: any) => `${props.value} is not a valid pincode!`,
      },
    },
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^\+?[\d\s-]{6,}$/.test(v);
        },
        message: (props: any) => `${props.value} is not a valid phone number!`,
      },
    },
    email: {
      type: String,
      trim: true,
    },
    telephoneNumber: {
      type: String,
      trim: true,
      validate: {
        validator: function (v: string) {
          return v ? /^\+?[\d\s-]{6,}$/.test(v) : true;
        },
        message: (props: any) => `${props.value} is not a valid phone number!`,
      },
    },
    trnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    locations: [locationSchema],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes
clientSchema.index({ clientName: 1 });
clientSchema.index({ trnNumber: 1 });
clientSchema.index({ pincode: 1 });
clientSchema.index({ accountNumber: 1 });

export const Client = model<IClient>("Client", clientSchema);
