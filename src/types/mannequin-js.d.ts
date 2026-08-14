declare module 'mannequin-js/src/mannequin.js' { export function blend(a: any, b: any, k: number): any; }
declare module 'mannequin-js/src/bodies/Mannequin.js' { export class Mannequin { [key:string]: any; posture: unknown; select(s: boolean): void; stepOnGround(): void; } }
declare module 'mannequin-js/src/bodies/Male.js' { export class Male { [key:string]: any; posture: unknown; select(s: boolean): void; stepOnGround(): void; } }
declare module 'mannequin-js/src/bodies/Female.js' { export class Female { [key:string]: any; posture: unknown; select(s: boolean): void; stepOnGround(): void; } }
declare module 'mannequin-js/src/bodies/Child.js' { export class Child { [key:string]: any; posture: unknown; select(s: boolean): void; stepOnGround(): void; } }
