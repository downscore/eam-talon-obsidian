export interface Request {
  // The ID of the command to run.
  commandId: string;

  // A uuid to echo in the response so it can be matched to this request.
  uuid: string;

  // Arguments to the command, if any.
  args: any[];

  // Whether the response should include the output of the command. If this is true, we will wait for the command to
  // finish regardless of the value of `waitForFinish`.
  returnCommandOutput: boolean;

  // Whether we should wait for the command to complete before returning a response.
  // For some commands, such as ones that show a quick picker, this can hang the client.
  waitForFinish: boolean;
}
