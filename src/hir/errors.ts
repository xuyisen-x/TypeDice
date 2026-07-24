import type { CstNodeLocation, CstNode, IToken } from "chevrotain"

export class HirBuildException extends Error {
  constructor(
    message: string,
    public readonly location?: CstNodeLocation
  ) {
    super(message)
  }
}

export function hirError(message: string, node: CstNode): never {
  throw new HirBuildException(message, node.location)
}

export function hirErrorToken(message: string, token: IToken): never {
  throw new HirBuildException(message, token)
}

export interface HirBuildError {
  message: string
  location?: CstNodeLocation
}
