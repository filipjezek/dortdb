import { UnsupportedError } from '@dortdb/core';
import { MultiDirectedGraph } from 'graphology';
import { Attributes } from 'graphology-types';

export type EdgeDirection = 'in' | 'out' | 'any';

export interface CypherDataAdaper<
  GraphType = any,
  NodeType extends Record<string, unknown> = any,
  EdgeType extends Record<string, unknown> = any,
> {
  getNodesByLabels(graph: GraphType, ...labels: string[]): Iterable<NodeType>;
  filterNodes(
    graph: GraphType,
    predicate?: (node: NodeType) => boolean,
  ): Iterable<NodeType>;
  getEdgesByType(graph: GraphType, type: string): Iterable<NodeType>;
  filterEdges(
    graph: GraphType,
    predicate?: (edge: NodeType) => boolean,
  ): Iterable<NodeType>;
  getNodeEdgesByType(
    graph: GraphType,
    node: NodeType,
    type: string,
    direction: EdgeDirection,
  ): Iterable<EdgeType>;
  filterNodeEdges(
    graph: GraphType,
    node: NodeType,
    direction: EdgeDirection,
    predicate?: (node: NodeType, edge: EdgeType) => boolean,
  ): Iterable<EdgeType>;
  getEdgeNode(
    graph: GraphType,
    edge: EdgeType,
    type: 'source' | 'target',
  ): NodeType;

  isConnected(
    graph: GraphType,
    node: NodeType,
    edge: EdgeType,
    direction: EdgeDirection,
  ): boolean;
  hasLabels(graph: GraphType, node: NodeType, labels: string[]): boolean;
  hasAnyType(graph: GraphType, edge: EdgeType, types: string[]): boolean;
}

export const nodeOrEdgeId = Symbol('nodeOrEdgeId');
type GraphologyNode = Attributes & { labels: string[]; [nodeOrEdgeId]: string };
type GraphologyEdge = Attributes & { type: string; [nodeOrEdgeId]: string };
type GraphologyGraph = MultiDirectedGraph<
  GraphologyNode,
  GraphologyEdge,
  Attributes
>;

export class GraphologyDataAdapter
  implements CypherDataAdaper<GraphologyGraph>
{
  private convertNode(
    node: string,
    attrs: Attributes & Record<string | symbol, unknown>,
  ): GraphologyNode {
    attrs[nodeOrEdgeId] = node;
    return attrs as GraphologyNode;
  }

  private convertEdge(
    edge: string,
    attrs: Attributes & Record<string | symbol, unknown>,
  ): GraphologyEdge {
    attrs[nodeOrEdgeId] = edge;
    return attrs as GraphologyEdge;
  }

  *getNodesByLabels(
    graph: GraphologyGraph,
    ...labels: string[]
  ): Iterable<GraphologyNode> {
    for (const { node, attributes } of graph.nodeEntries()) {
      const nodeLabels = attributes.labels ?? [];
      if (labels.every((label) => nodeLabels.includes(label))) {
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
      if (attributes.type === type) {
        yield this.convertEdge(edge, attributes);
      }
    }
  }
  *filterEdges(
    graph: GraphologyGraph,
    predicate?: (edge: GraphologyEdge) => boolean,
  ): Iterable<GraphologyEdge> {
    if (!predicate) {
      for (const { edge, attributes } of graph.edgeEntries()) {
        yield this.convertEdge(edge, attributes);
      }
    } else {
      for (const { edge, attributes } of graph.edgeEntries()) {
        const converted = this.convertEdge(edge, attributes);
        if (predicate(converted)) {
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
    ](node[nodeOrEdgeId])) {
      if (attributes.type === type) {
        yield this.convertEdge(edge, attributes);
      }
    }
  }
  *filterNodeEdges(
    graph: GraphologyGraph,
    node: GraphologyNode,
    direction: EdgeDirection,
    predicate?: (node: GraphologyNode, edge: GraphologyEdge) => boolean,
  ): Iterable<GraphologyEdge> {
    for (const { edge, attributes } of graph[
      direction === 'in'
        ? 'inEdgeEntries'
        : direction === 'out'
          ? 'outEdgeEntries'
          : 'edgeEntries'
    ](node[nodeOrEdgeId])) {
      const converted = this.convertEdge(edge, attributes);
      if (!predicate || predicate(node, converted)) {
        yield converted;
      }
    }
  }

  isConnected(
    graph: GraphologyGraph,
    node: GraphologyNode,
    edge: GraphologyEdge,
    direction: EdgeDirection,
  ): boolean {
    const edgeId = edge[nodeOrEdgeId];
    return graph[
      direction === 'in'
        ? 'someInboundEdge'
        : direction === 'out'
          ? 'someOutboundEdge'
          : 'someEdge'
    ](node[nodeOrEdgeId], (e) => e === edgeId);
  }
  hasLabels(
    graph: GraphologyGraph,
    node: GraphologyNode,
    labels: string[],
  ): boolean {
    return (node.labels ?? []).every((label) => labels.includes(label));
  }
  hasAnyType(
    graph: GraphologyGraph,
    edge: GraphologyEdge,
    types: string[],
  ): boolean {
    return types.includes(edge.type);
  }
  getEdgeNode(
    graph: GraphologyGraph,
    edge: GraphologyEdge,
    type: 'source' | 'target',
  ): GraphologyNode {
    const node = graph[type](edge[nodeOrEdgeId]);
    return this.convertNode(node, graph.getNodeAttributes(node));
  }
}
