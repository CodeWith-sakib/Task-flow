/**
 * Envoy-Compatible xDS (Discovery Service) Configuration Generator.
 * Generates Cluster Discovery Service (CDS), Listener Discovery Service (LDS),
 * and Endpoint Discovery Service (EDS) JSON resources for service mesh data planes.
 */

export interface XdsClusterConfig {
  name: string;
  connectTimeoutMs: number;
  endpoints: { address: string; port: number; weight: number }[];
  enableTls: boolean;
  circuitBreakerMaxConnections?: number;
}

export class EnvoyXdsAdapter {
  public generateCdsResponse(clusters: XdsClusterConfig[]): Record<string, any> {
    return {
      version_info: String(Date.now()),
      resources: clusters.map((c) => ({
        '@type': 'type.googleapis.com/envoy.config.cluster.v3.Cluster',
        name: c.name,
        type: 'STRICT_DNS',
        connect_timeout: `${c.connectTimeoutMs / 1000}s`,
        lb_policy: 'ROUND_ROBIN',
        load_assignment: {
          cluster_name: c.name,
          endpoints: [
            {
              lb_endpoints: c.endpoints.map((ep) => ({
                endpoint: {
                  address: {
                    socket_address: {
                      address: ep.address,
                      port_value: ep.port,
                    },
                  },
                },
                load_balancing_weight: { value: ep.weight },
              })),
            },
          ],
        },
        circuit_breakers: {
          thresholds: [
            {
              priority: 'DEFAULT',
              max_connections: c.circuitBreakerMaxConnections || 1024,
            },
          ],
        },
      })),
    };
  }

  public generateLdsResponse(listenerName: string, port: number, targetCluster: string): Record<string, any> {
    return {
      version_info: String(Date.now()),
      resources: [
        {
          '@type': 'type.googleapis.com/envoy.config.listener.v3.Listener',
          name: listenerName,
          address: {
            socket_address: {
              address: '0.0.0.0',
              port_value: port,
            },
          },
          filter_chains: [
            {
              filters: [
                {
                  name: 'envoy.filters.network.http_connection_manager',
                  typed_config: {
                    '@type': 'type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager',
                    stat_prefix: 'ingress_http',
                    route_config: {
                      name: 'local_route',
                      virtual_hosts: [
                        {
                          name: 'local_service',
                          domains: ['*'],
                          routes: [
                            {
                              match: { prefix: '/' },
                              route: { cluster: targetCluster },
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }
}
