import { StateCreator } from 'zustand';
import type { NotesStore } from '../types';
import {
  type FileSystemSlice,
  fileSystemSliceInitialState,
} from './fileSystemSliceContracts';
import { createFileSystemCreateActions } from './fileSystemSliceCreateActions';
import { createFileSystemDeleteActions } from './fileSystemSliceDeleteActions';
import { createFileSystemRenameActions } from './fileSystemSliceRenameActions';
import { createFileSystemTreeActions } from './fileSystemSliceTreeActions';

export type { FileSystemSlice } from './fileSystemSliceContracts';

export const createFileSystemSlice: StateCreator<NotesStore, [], [], FileSystemSlice> = (
  set,
  get,
) => ({
  ...fileSystemSliceInitialState,
  ...createFileSystemTreeActions(set, get),
  ...createFileSystemCreateActions(set, get),
  ...createFileSystemDeleteActions(set, get),
  ...createFileSystemRenameActions(set, get),
});
