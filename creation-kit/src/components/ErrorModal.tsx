import { Button, Modal } from "@mantine/core";

export function ErrorModal({
  opened,
  onClose,
  stackId,
  onExitTransitionEnd,
}: {
  opened: boolean;
  onClose: () => void;
  stackId?: string | undefined;
  onExitTransitionEnd?: (() => void) | undefined;
}) {
  const stackProps = stackId === undefined ? {} : { stackId };
  const transitionProps =
    onExitTransitionEnd === undefined ? {} : { onExitTransitionEnd };
  return (
    <Modal
      {...stackProps}
      {...transitionProps}
      opened={opened}
      onClose={onClose}
      title="Something went wrong!"
      withCloseButton={false}
      centered
    >
      <Button onClick={onClose}>OK</Button>
    </Modal>
  );
}
