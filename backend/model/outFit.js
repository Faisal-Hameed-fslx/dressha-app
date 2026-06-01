import mongoose from "mongoose";

const outFitSchema = new mongoose.Schema({
    // canonical field name 'occasion' (fix typo from previous 'ocassion')
    occasion: { type: String },
    style: { type: String },
    // items can be strings or objects depending on source, allow mixed entries
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    image: { type: String },
    embedding: { type: [Number] },
});

export default mongoose.model("OutFit", outFitSchema);