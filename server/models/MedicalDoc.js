import mongoose from "mongoose";

const medicalDocumentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    documentName: {
      type: String,
      required: true,
    },

    filePath: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model(
  "MedicalDocument",
  medicalDocumentSchema
);