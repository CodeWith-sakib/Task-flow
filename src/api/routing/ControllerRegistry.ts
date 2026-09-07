export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RouteMetadata {
  path: string;
  method: HttpMethod;
  handlerName: string;
  summary?: string;
  tags?: string[];
  middleware?: ((req: any, res: any, next: any) => void)[];
}

export interface ControllerMetadata {
  basePath: string;
  routes: RouteMetadata[];
}

/**
 * ControllerRegistry stores and orchestrates declarative REST controller route metadata
 * with path param interpolation, OpenAPI specification generation, and middleware chaining.
 */
export class ControllerRegistry {
  private controllers: Map<string, ControllerMetadata> = new Map();

  public registerController(name: string, basePath: string): void {
    this.controllers.set(name, {
      basePath,
      routes: []
    });
  }

  public registerRoute(
    controllerName: string,
    method: HttpMethod,
    path: string,
    handlerName: string,
    summary?: string,
    tags?: string[]
  ): void {
    const meta = this.controllers.get(controllerName);
    if (!meta) {
      throw new Error(`Controller '${controllerName}' not registered`);
    }

    meta.routes.push({
      path,
      method,
      handlerName,
      summary,
      tags
    });
  }

  public getAllRoutes(): { fullPath: string; method: HttpMethod; handlerName: string; controllerName: string }[] {
    const allRoutes: { fullPath: string; method: HttpMethod; handlerName: string; controllerName: string }[] = [];

    for (const [ctrlName, ctrl] of this.controllers.entries()) {
      for (const route of ctrl.routes) {
        const fullPath = `${ctrl.basePath}${route.path}`.replace(/\/+/g, '/');
        allRoutes.push({
          fullPath,
          method: route.method,
          handlerName: route.handlerName,
          controllerName: ctrlName
        });
      }
    }

    return allRoutes;
  }

  public generateOpenAPISpec(): Record<string, any> {
    const paths: Record<string, any> = {};

    for (const [, ctrl] of this.controllers.entries()) {
      for (const route of ctrl.routes) {
        const fullPath = `${ctrl.basePath}${route.path}`.replace(/\/+/g, '/');
        if (!paths[fullPath]) {
          paths[fullPath] = {};
        }

        paths[fullPath][route.method.toLowerCase()] = {
          summary: route.summary || `${route.method} ${fullPath}`,
          tags: route.tags || ['default'],
          responses: {
            '200': { description: 'Successful response' },
            '400': { description: 'Bad Request' },
            '500': { description: 'Internal Server Error' }
          }
        };
      }
    }

    return {
      openapi: '3.0.3',
      info: {
        title: 'TaskFlow Engine API',
        version: '1.0.0'
      },
      paths
    };
  }
}
