/**
 * Image Upload Plugin - Handles pasting and dropping images into the editor
 * 
 * Intercepts paste/drop events, uploads images via the asset system,
 * and inserts the resulting image node into the document.
 */

import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import { useNotesStore } from '@/stores/notes/useNotesStore';

export const imageUploadPluginKey = new PluginKey('neko-image-upload');

/**
 * Creates an image upload plugin that handles paste/drop of image files
 */
export const imageUploadPlugin = $prose(() => {
    return new Plugin({
        key: imageUploadPluginKey,
        props: {
            handleDOMEvents: {
                // Handle paste events (clipboard)
                paste(view, event) {
                    const items = event.clipboardData?.items;
                    if (!items) return false;

                    let handled = false;
                    const imageFiles: File[] = [];

                    // Collect all image files first
                    for (const item of items) {
                        if (item.type.startsWith('image/')) {
                            const file = item.getAsFile();
                            if (file) {
                                imageFiles.push(file);
                                handled = true;
                            }
                        }
                    }

                    if (handled) {
                        event.preventDefault();
                        // Process sequentially to ensure correct conflict resolution ordering
                        (async () => {
                            for (const file of imageFiles) {
                                await handleImageUpload(file, view);
                            }
                        })();
                        return true;
                    }

                    return false;
                },

                // Handle drop events (drag & drop)
                drop(view, event) {
                    const files = event.dataTransfer?.files;
                    if (!files || files.length === 0) return false;

                    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

                    if (imageFiles.length > 0) {
                        event.preventDefault();
                        // Process sequentially to ensure correct conflict resolution ordering
                        (async () => {
                            for (const file of imageFiles) {
                                await handleImageUpload(file, view);
                            }
                        })();
                        return true;
                    }

                    return false;
                }
            }
        }
    });
});

/**
 * Uploads an image file and inserts the resulting node into the editor
 */
async function handleImageUpload(file: File, view: any) {
    const { uploadAsset, currentNote } = useNotesStore.getState();

    try {
        // Upload with current note path for proper storage location
        const result = await uploadAsset(file, 'covers', currentNote?.path);

        if (result.success && result.path) {
            // Insert image node at current cursor position
            const { state, dispatch } = view;
            const { schema, tr } = state;

            // Find the image node type
            const imageNodeType = schema.nodes.image;
            if (!imageNodeType) {
                console.error('[ImageUpload] Image node type not found in schema');
                return;
            }

            // Extract filename from the uploaded path for the caption
            // This ensures we use the sanitized/timestamped name instead of generic "image.png"
            const fileName = result.path.split('/').pop() || result.path;
            const altText = fileName.replace(/\.[^/.]+$/, '');

            // Create image node with the uploaded path
            const imageNode = imageNodeType.create({
                src: result.path,
                alt: altText,
            });

            // Insert at current selection
            const pos = state.selection.from;
            dispatch(tr.insert(pos, imageNode));
        } else {
            console.error('[ImageUpload] Upload failed:', result.error);
        }
    } catch (error) {
        console.error('[ImageUpload] Error during upload:', error);
    }
}