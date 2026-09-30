import { oc } from "@orpc/contract";
import { Schema } from "effect";

export const ScanBatchSchema = Schema.Struct({
  name: Schema.String,
  sizeBytes: Schema.Number,
  modifiedAt: Schema.String,
});

export const TagSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  createdAt: Schema.String,
});

export type ScanBatch = typeof ScanBatchSchema.Type;
export type Tag = typeof TagSchema.Type;

export const contract = {
  health: oc.output(
    Schema.standardSchemaV1(Schema.Struct({ status: Schema.Literal("ok") })),
  ),
  inbox: {
    list: oc.output(Schema.standardSchemaV1(Schema.Array(ScanBatchSchema))),
  },
  tags: {
    list: oc.output(Schema.standardSchemaV1(Schema.Array(TagSchema))),
    create: oc
      .input(
        Schema.standardSchemaV1(
          Schema.Struct({
            name: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(60)),
          }),
        ),
      )
      .output(Schema.standardSchemaV1(TagSchema)),
    remove: oc
      .input(Schema.standardSchemaV1(Schema.Struct({ id: Schema.String })))
      .output(
        Schema.standardSchemaV1(Schema.Struct({ deleted: Schema.Boolean })),
      ),
  },
};
