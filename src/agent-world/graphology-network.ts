import { UndirectedGraph } from "graphology";
import clusters from "graphology-generators/random/clusters";
import { xoroshiro128plus } from "pure-rand";
import type { AgentNetwork, AgentWorldConfig, NetworkProvider } from "./protocol";

const UINT32_RANGE = 0x1_0000_0000;

export function createGraphologyClusteredNetwork(config: AgentWorldConfig): AgentNetwork {
  const generator = xoroshiro128plus((config.worldSeed ^ 0x9e3779b9) | 0);
  const rng = () => (generator.unsafeNext() >>> 0) / UINT32_RANGE;
  const graph = clusters(UndirectedGraph, {
    order: config.citizenCount,
    size: Math.max(config.citizenCount - 1, Math.round(config.citizenCount * 1.75)),
    clusters: config.network.clusterCount,
    clusterDensity: 0.78,
    rng,
  });

  for (let citizenId = 0; citizenId < config.citizenCount; citizenId += 1) {
    if (graph.degree(citizenId) === 0) graph.mergeEdge(citizenId, (citizenId + 1) % config.citizenCount);
  }

  const citizenIds = graph.nodes().map(Number).sort((left, right) => left - right);
  const clusterByCitizen = Object.fromEntries(citizenIds.map((citizenId) => [
    citizenId,
    Number(graph.getNodeAttribute(citizenId, "cluster")),
  ])) as Record<number, number>;
  const neighborsByCitizen = Object.fromEntries(citizenIds.map((citizenId) => [
    citizenId,
    graph.neighbors(citizenId).map(Number).sort((left, right) => left - right),
  ])) as Record<number, number[]>;
  const edges = graph.edges().map((edge) => {
    const [left, right] = graph.extremities(edge).map(Number);
    return { source: Math.min(left, right), target: Math.max(left, right), weight: 1 };
  }).sort((left, right) => left.source - right.source || left.target - right.target);

  return { citizenIds, clusterByCitizen, neighborsByCitizen, edges };
}

export const graphologyNetworkProvider: NetworkProvider = { create: createGraphologyClusteredNetwork };
