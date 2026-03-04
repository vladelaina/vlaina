import type { ComponentProps } from 'react';
import { Icon } from '@/components/ui/icons';

type DeleteIconProps = Omit<ComponentProps<typeof Icon>, 'name' | 'size'>;

export function DeleteIcon(props: DeleteIconProps) {
  return <Icon name="common.delete" size="md" {...props} />;
}
