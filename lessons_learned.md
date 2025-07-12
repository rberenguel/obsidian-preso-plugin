This document summarizes the lessons learned during the development of the Obsidian Slides plugin by Gemini for future reference.

## 1. Obsidian API Quirks

*   **`WorkspaceLeaf.id` vs `MarkdownView.file.path`**: The `id` property of a `WorkspaceLeaf` is not a reliable way to identify a leaf, as it can change. It is better to use the file path of the `MarkdownView` as a unique identifier for the preview views.
*   **Event Handling**: The Obsidian API has a specific way of handling events. It is important to use the correct event and to register and unregister events properly to avoid memory leaks and unexpected behavior. For editor events, it is better to use `this.app.workspace.on('editor-change', ...)` and then check if the change happened in the editor of interest, rather than trying to register the event directly on the editor object.
*   **Type Casting**: The Obsidian API uses a lot of generic types. It is often necessary to cast objects to their specific types (e.g., `leaf.view` to `MarkdownView`) to access their properties and methods. It is important to check the type of the object before casting it to avoid errors.

## 2. `interact.js` Integration

*   **No Type Definitions**: The `interact.js` library does not have official TypeScript type definitions. This makes it a bit more challenging to use in a TypeScript project, but it is still possible by using `// @ts-ignore` or by creating custom type definitions.
*   **Bundling**: `interact.js` can be easily bundled with the plugin using `esbuild` and `npm`.

## 3. Development Process

*   **Incremental Development**: The plan was well-structured and allowed for incremental development. This made it easier to implement and test each feature separately.
*   **Testing**: The lack of an automated testing setup made it more difficult to catch errors early. A good testing setup would have saved a lot of time and effort.
*   **Compilation Errors**: The TypeScript compiler is a great tool to catch errors early. It is important to pay attention to the compiler errors and to fix them as soon as they appear.
