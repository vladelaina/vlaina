import { GroupSlice } from './slices/groupSlice';
import { TaskSlice } from './slices/taskSlice';
import { PersistenceSlice } from './slices/persistenceSlice';

export type StoreState = GroupSlice & TaskSlice & PersistenceSlice;
