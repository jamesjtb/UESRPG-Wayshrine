import { Button, Modal } from "@mantine/core";

export function ErrorModal({
  opened,
  onClose,
  stackId,
}: {
  opened: boolean;
  onClose: () => void;
  stackId?: string | undefined;
}) {
  const stackProps = stackId === undefined ? {} : { stackId };
  return (
    <Modal
      {...stackProps}
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
