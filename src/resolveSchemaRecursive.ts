// @apidevtools/json-schema-ref-parser requires "path", which causes it not to work in "edge" runtime of Verecel
// maybe replace with https://www.npmjs.com/package/@stoplight/json-ref-resolver

import { dereference, bundle } from "@apidevtools/json-schema-ref-parser";

/**
 * Will resolve all external references recursively to end up with a schema without references (or only internal references)
 *
 * Uses https://github.com/APIDevTools/json-schema-ref-parser
 *
 * Returns the document without references in the schemas.
 */
export const resolveSchemaRecursive = async (context: {
  /** If you want the thing to resolve relative files, we need to provide an URL or absolute path here (see https://github.com/APIDevTools/json-schema-ref-parser/issues/339) */
  documentUri?: string;
  /** If you don't need relative resolving, you can provide a document directly. */
  document?: { [key: string]: any };
  /** If true, the final schema will not contain any references anymore,
   *
   * (but it will not remove the original definitons or components/schemas). */
  shouldDereference?: boolean;
}) => {
  const { document, documentUri, shouldDereference } = context;

  if (shouldDereference) {
    try {
      return dereference(documentUri || document, {
        continueOnError: true,
        dereference: { circular: "ignore" },
        timeoutMs: 45000,
        mutateInputSchema: false,
        resolve: { external: true },
      });
    } catch (err: any) {
      console.log(
        "Error in resolveSchemaRecursive",
        err.errors.map((e: any) => ({ name: e.name, message: e.message })),
      );

      return;
    }
  }

  try {
    const result = await bundle(documentUri || document, {
      continueOnError: true,
      timeoutMs: 45000,
      mutateInputSchema: false,
      resolve: { external: true },
    });

    return result as any;
  } catch (err: any) {
    console.log(
      "Error in resolveSchemaRecursive",
      err.errors.map((e: any) => ({ name: e.name, message: e.message })),
    );

    return;
  }
};
