declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module 'ogl' {
  export class Renderer {
    constructor(...args: unknown[]);
    gl: WebGLRenderingContext & { canvas: HTMLCanvasElement };
    dpr: number;
    setSize(width: number, height: number): void;
    render(options: { scene: unknown }): void;
  }

  export class Program {
    constructor(...args: unknown[]);
    uniforms: Record<string, { value: unknown }>;
  }

  export class Mesh {
    constructor(...args: unknown[]);
  }

  export class Color {
    constructor(...args: unknown[]);
  }

  export class Geometry {
    constructor(...args: unknown[]);
  }
}
