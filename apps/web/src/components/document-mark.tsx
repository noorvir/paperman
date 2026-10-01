import type { components } from "@/lib/schema";
import { getDocumentTags, getTagIcon } from "@/lib/catalog-icons";
import { FileMark } from "./collection";

export function DocumentMark({
  document,
  catalog,
}: {
  document: components["schemas"]["Document"];
  catalog: components["schemas"]["Catalog"];
}) {
  const tags = getDocumentTags(document, catalog);
  const subject = tags.find((tag) => tag.id !== "invoice") ?? tags[0];
  return <FileMark icon={getTagIcon(subject)} />;
}
