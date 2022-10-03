export const getEventArgs = (
  events: any,
  name: string,
  logIndex: number | undefined = undefined
) => {
  const event =
    events &&
    events.find((e: any) =>
      logIndex !== undefined ? e.logIndex === logIndex && e.event === name : e.event === name
    );
  const args = event && event.args;
  return args;
};
