import mongoose from "mongoose";

export const connectDb = async () => {
  try {
    const conn = await mongoose.connect("mongodb://localhost:27017/alghaza");
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }
};
