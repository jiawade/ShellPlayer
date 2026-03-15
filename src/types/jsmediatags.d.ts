declare module 'jsmediatags' {
  interface TagType {
    tags: {
      title?: string;
      artist?: string;
      album?: string;
      year?: string;
      track?: string;
      genre?: string;
      picture?: {
        format: string;
        type: string;
        description: string;
        data: number[];
      };
    };
  }

  interface ReaderOptions {
    onSuccess: (tag: TagType) => void;
    onError: (error: { type: string; info: string }) => void;
  }

  function read(file: string | File, options: ReaderOptions): void;
  export default { read };
  export { read };
}
