import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { useNotesStore } from '@/stores/notes/useNotesStore';

export const imageUploadPluginKey = new PluginKey('neko-image-upload');

export const imageUploadPlugin = $prose(() => {
    return new Plugin({
        key: imageUploadPluginKey,
        props: {
            handleDOMEvents: {
                paste(view, event) {
                    const items = event.clipboardData?.items;
                    if (!items) return false;

                    let handled = false;
                    const imageFiles: File[] = [];

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
                        (async () => {
                            for (const file of imageFiles) {
                                await handleImageUpload(file, view);
                            }
                        })();
                        return true;
                    }

                    return false;
                },

                drop(view, event) {
                    const files = event.dataTransfer?.files;
                    if (!files || files.length === 0) return false;

                    const imageFiles = Array.from(files as FileList).filter((file: File) => file.type.startsWith('image/'));

                    if (imageFiles.length > 0) {
                        event.preventDefault();
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

async function handleImageUpload(file: File, view: EditorView) {
    const { uploadAsset, currentNote } = useNotesStore.getState();

    try {
        const result = await uploadAsset(file, 'content', currentNote?.path);

        if (result.success && result.path) {
            const { state, dispatch } = view;
            const { schema, tr } = state;

            const imageNodeType = schema.nodes.image;
            if (!imageNodeType) {
                console.error('[ImageUpload] Image node type not found in schema');
                return;
            }

            const fileName = result.path.split('/').pop() || result.path;
            const altText = fileName.replace(/\.[^/.]+$/, '');

            const imageNode = imageNodeType.create({
                src: result.path,
                alt: altText,
                align: 'center',
                width: null,
            });

            const pos = state.selection.from;
            dispatch(tr.insert(pos, imageNode));
        } else {
            console.error('[ImageUpload] Upload failed:', result.error);
        }
    } catch (error) {
        console.error('[ImageUpload] Error during upload:', error);
    }
}
