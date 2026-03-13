declare module "jwt-encode" {
  export default function jwtEncode(
    payload: Record<string, unknown>,
    secret: string,
    algorithm?: string,
  ): string;
}
