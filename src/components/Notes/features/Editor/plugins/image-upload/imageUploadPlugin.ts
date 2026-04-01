import { $prose } from '@milkdown/kit/utils';
import { Plugin, PluginKey } from '@milkdown/kit/prose/state';
import {
    extractImageFilesFromClipboardItems,
    extractImageFilesFromFileList,
    uploadImagesAndInsert,
} from './imageUploadHelpers';

export const imageUploadPluginKey = new PluginKey('vlaina-image-upload');

export const imageUploadPlugin = $prose(() => {
    return new Plugin({
        key: imageUploadPluginKey,
        props: {
            handleDOMEvents: {
                paste(view, event) {
                    const imageFiles = extractImageFilesFromClipboardItems(event.clipboardData?.items);
                    if (imageFiles.length === 0) return false;

                    event.preventDefault();
                    void uploadImagesAndInsert(imageFiles, view);
                    return true;
                },

                drop(view, event) {
                    const imageFiles = extractImageFilesFromFileList(event.dataTransfer?.files);
                    if (imageFiles.length === 0) return false;

                    event.preventDefault();
                    void uploadImagesAndInsert(imageFiles, view);
                    return true;
                }
            }
        }
    });
});
