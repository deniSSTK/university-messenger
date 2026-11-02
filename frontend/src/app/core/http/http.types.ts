import { HttpHeaders, HttpParams } from '@angular/common/http';

interface HttpRequestOptions {
  isPrivate?: boolean;
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?:
    | HttpParams
    | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  withCredentials?: boolean;
}

export type { HttpRequestOptions };
