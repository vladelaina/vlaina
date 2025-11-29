import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ActivityHeatmap } from './ActivityHeatmap';

interface StatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StatsDialog({ open, onOpenChange }: StatsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity Statistics</DialogTitle>
        </DialogHeader>
        <ActivityHeatmap />
      </DialogContent>
    </Dialog>
  );
}
