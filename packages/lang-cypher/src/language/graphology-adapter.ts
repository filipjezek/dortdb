import { MultiDirectedGraph } from 'graphology';
import { Attributes } from 'graphology-types';
import { CypherDataAdaper, EdgeDirection } from './data-adapter.js';

/**
 * A key used to store the unique identifier for a node or edge in its attributes. (GraphologyAdapter)
 */
export const gaNodeOrEdgeId = Symbol('nodeOrEdgeId');
/**
 * A key used to store the node labels or edge type in its attributes. (GraphologyAdapter)
 */
export const gaLabelsOrType = Symbol('labelsOrType');
export type GraphologyNode = Attributes & {
  [gaLabelsOrType]: string[];
  [gaNodeOrEdgeId]: string;
};
export type GraphologyEdge = Attributes & {
  [gaLabelsOrType]: string;
  [gaNodeOrEdgeId]: string;
};
export type GraphologyGraph = MultiDirectedGraph<
  GraphologyNode,
  GraphologyEdge,
  Attributes
>;

const serializedLabelsKey = '__symbol__labelsOrType';
interface SerializedGraphology {
  nodes: {
    key: string;
    attributes: Attributes & { [serializedLabelsKey]: string[] };
  }[];
  edges: {
    key: string;
    source: string;
    target: string;
    attributes: Attributes & { [serializedLabelsKey]: string };
  }[];
}

/**
 * In order not to create unnecessary functions for each check with `.every`
 */
const isSubset = <T>(subset: T[], set: T[]): boolean => {
  for (const item of subset) {
    if (!set.includes(item)) return false;
  }
  return true;
};

/**
 * A data adapter for the Graphology graph library. The node labels/edge types are expected to be stored
 * in the attributes using the `gaLabelsOrType` symbol key. Convenience functions are provided to serialize
 * and deserialize the graph to/from a format that can be stored (since symbols are not generally serializable).
 */
export class GraphologyDataAdapter implements CypherDataAdaper<GraphologyGraph> {
  protected convertNode(
    node: string,
    attrs: Attributes & Record<string | symbol, unknown>,
  ): GraphologyNode {
    attrs[gaNodeOrEdgeId] = node;
    return attrs as GraphologyNode;
  }

  protected convertEdge(
    edge: string,
    attrs: Attributes & Record<string | symbol, unknown>,
  ): GraphologyEdge {
    attrs[gaNodeOrEdgeId] = edge;
    return attrs as GraphologyEdge;
  }

  *getNodesByLabels(
    graph: GraphologyGraph,
    ...labels: string[]
  ): Iterable<GraphologyNode> {
    for (const { node, attributes } of graph.nodeEntries()) {
      const nodeLabels = attributes[gaLabelsOrType] ?? [];
      if (isSubset(labels, nodeLabels)) {
        yield this.convertNode(node, attributes);
      }
    }
  }
  *filterNodes(
    graph: GraphologyGraph,
    predicate?: (node: GraphologyNode) => boolean,
  ): Iterable<GraphologyNode> {
    if (!predicate) {
      yield* graph.mapNodes(this.convertNode);
    } else {
      for (const { node, attributes } of graph.nodeEntries()) {
        const converted = this.convertNode(node, attributes);
        if (predicate(converted)) {
          yield converted;
        }
      }
    }
  }
  *getEdgesByType(
    graph: GraphologyGraph,
    type: string,
  ): Iterable<GraphologyEdge> {
    for (const { edge, attributes } of graph.edgeEntries()) {
      if (attributes[gaLabelsOrType] === type) {
        yield this.convertEdge(edge, attributes);
      }
    }
  }
  *filterEdges(
    graph: GraphologyGraph,
    predicate?: (
      src: GraphologyNode,
      tgt: GraphologyNode,
      edge: GraphologyEdge,
    ) => boolean,
  ): Iterable<GraphologyEdge> {
    if (!predicate) {
      for (const { edge, attributes } of graph.edgeEntries()) {
        yield this.convertEdge(edge, attributes);
      }
    } else {
      for (const edge of graph.edgeEntries()) {
        const converted = this.convertEdge(edge.edge, edge.attributes);
        const source = this.convertNode(edge.source, edge.sourceAttributes);
        const target = this.convertNode(edge.target, edge.targetAttributes);
        if (predicate(source, target, converted)) {
          yield converted;
        }
      }
    }
  }
  *getNodeEdgesByType(
    graph: GraphologyGraph,
    node: GraphologyNode,
    type: string,
    direction: EdgeDirection,
  ): Iterable<GraphologyEdge> {
    for (const { edge, attributes } of graph[
      direction === 'in'
        ? 'inEdgeEntries'
        : direction === 'out'
          ? 'outEdgeEntries'
          : 'edgeEntries'
    ](node[gaNodeOrEdgeId])) {
      if (attributes[gaLabelsOrType] === type) {
        yield this.convertEdge(edge, attributes);
      }
    }
  }
  *filterNodeEdges(
    graph: GraphologyGraph,
    node: GraphologyNode,
    direction: EdgeDirection,
    predicate?: (
      src: GraphologyNode,
      tgt: GraphologyNode,
      edge: GraphologyEdge,
    ) => boolean,
  ): Iterable<GraphologyEdge> {
    for (const edge of graph[
      direction === 'in'
        ? 'inEdgeEntries'
        : direction === 'out'
          ? 'outEdgeEntries'
          : 'edgeEntries'
    ](node[gaNodeOrEdgeId])) {
      const converted = this.convertEdge(edge.edge, edge.attributes);
      if (!predicate) {
        yield converted;
      } else {
        const source = this.convertNode(edge.source, edge.sourceAttributes);
        const target = this.convertNode(edge.target, edge.targetAttributes);
        if (predicate(source, target, converted)) {
          yield converted;
        }
      }
    }
  }

  isConnected(
    graph: GraphologyGraph,
    node: GraphologyNode,
    edge: GraphologyEdge,
    direction: EdgeDirection,
  ): boolean {
    const edgeId = edge[gaNodeOrEdgeId];
    return graph[
      direction === 'in'
        ? 'someInboundEdge'
        : direction === 'out'
          ? 'someOutboundEdge'
          : 'someEdge'
    ](node[gaNodeOrEdgeId], (e) => e === edgeId);
  }
  hasLabels(
    graph: GraphologyGraph,
    node: GraphologyNode,
    labels: string[],
  ): boolean {
    return isSubset(labels, node[gaLabelsOrType] ?? []);
  }
  getLabels(graph: GraphologyGraph, node: GraphologyNode): string[] {
    if (node === undefined || node === null) return null;
    return (node[gaLabelsOrType] ?? []) as string[];
  }
  hasAnyType(
    graph: GraphologyGraph,
    edge: GraphologyEdge,
    types: string[],
  ): boolean {
    return types.includes(edge[gaLabelsOrType]);
  }
  getType(graph: GraphologyGraph, edge: GraphologyEdge): string {
    if (edge === undefined || edge === null) return null;
    return edge[gaLabelsOrType];
  }
  getEdgeNode(
    graph: GraphologyGraph,
    edge: GraphologyEdge,
    type: 'source' | 'target',
  ): GraphologyNode {
    const node = graph[type](edge[gaNodeOrEdgeId]);
    return this.convertNode(node, graph.getNodeAttributes(node));
  }

  /**
   * Imports a serialized Graphology graph.
   */
  static import(serialized: unknown): GraphologyGraph {
    for (const n of (serialized as SerializedGraphology).nodes) {
      (n.attributes as any)[gaLabelsOrType] = n.attributes[serializedLabelsKey];
      delete n.attributes[serializedLabelsKey];
    }
    for (const e of (serialized as SerializedGraphology).edges) {
      (e.attributes as any)[gaLabelsOrType] = e.attributes[serializedLabelsKey];
      delete e.attributes[serializedLabelsKey];
    }
    return new MultiDirectedGraph<
      GraphologyNode,
      GraphologyEdge,
      Attributes
    >().import(serialized);
  }
  /**
   * Exports the Graphology graph to a serialized format.
   */
  static export(graph: GraphologyGraph): unknown {
    const exported = graph.export();
    for (const n of exported.nodes) {
      n.attributes ??= {} as any;
      n.attributes[serializedLabelsKey] = graph.getNodeAttributes(n.key)[
        gaLabelsOrType
      ];
    }
    for (const e of exported.edges) {
      e.attributes ??= {} as any;
      e.attributes[serializedLabelsKey] = graph.getEdgeAttributes(e.key)[
        gaLabelsOrType
      ];
    }
    return exported;
  }
}
