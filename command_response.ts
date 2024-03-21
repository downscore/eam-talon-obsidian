export interface Response {
  // The return value of the command, if requested.
  returnValue?: any;

  // The uuid from the request this response is for.
  uuid: string;

  // Error message or null if the command was executed successfully.
  error: string | null;

  // A list of warnings issued when running the command. Empty if there were no warnings.
  warnings: string[];
}
