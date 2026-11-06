declare module "picomatch" {
  type Options = { basename?: boolean };
  export default function picomatch(pattern: string, options?: Options): (input: string) => boolean;
}
