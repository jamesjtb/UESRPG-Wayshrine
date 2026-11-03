import { Button, Modal } from "@mantine/core";

export function ErrorModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
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
