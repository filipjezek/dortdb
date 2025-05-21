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
  getNodeProperty(graph: GraphType, node: NodeType, property: string): unknown;
  getNodeProperties(graph: GraphType, node: NodeType): Record<string, unknown>;
  getEdgeProperty(graph: GraphType, edge: EdgeType, property: string): unknown;
  getEdgeProperties(graph: GraphType, edge: EdgeType): Record<string, unknown>;
  getEdgeNode(
    graph: GraphType,
    edge: EdgeType,
    type: 'source' | 'target',
  ): NodeType;

  isConnected(
    graph: GraphType,
    edge: EdgeType,
    node: NodeType,
    direction: EdgeDirection,
  ): boolean;
  hasLabel(graph: GraphType, node: NodeType, label: string): boolean;
  hasType(graph: GraphType, edge: EdgeType, type: string): boolean;
}

export class GraphologyDataAdapter
  implements
    CypherDataAdaper<
      MultiDirectedGraph<
        Attributes & { labels: string[] },
        Attributes & { type: string },
        Attributes
      >
    >
{
  *getNodesByLabels(
    graph: MultiDirectedGraph<
      Attributes & { labels: string[] },
      Attributes & { type: string },
      Attributes
    >,
    ...labels: string[]
  ): Iterable<unknown> {
    for (const node of graph.nodes()) {
      const nodeLabels = graph.getNodeAttribute(node, 'labels') ?? [];
      if (labels.every((label) => nodeLabels.includes(label))) {
        yield node;
      }
    }
  }
  *filterNodes(
    graph: MultiDirectedGraph,
    predicate?: (node: unknown) => boolean,
  ): Iterable<unknown> {
    if (!predicate) {
      return graph.nodes();
    } else {
      for (const node of graph.nodes()) {
        if (predicate(node)) {
          yield node;
        }
      }
    }
  }
  *getEdgesByType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    type: string,
  ): Iterable<unknown> {
    for (const edge of graph.edges()) {
      if (graph.getEdgeAttribute(edge, 'type') === type) {
        yield edge;
      }
    }
  }
  *filterEdges(
    graph: MultiDirectedGraph,
    predicate?: (edge: unknown) => boolean,
  ): Iterable<unknown> {
    if (!predicate) {
      return graph.edges();
    } else {
      for (const edge of graph.edges()) {
        if (predicate(edge)) {
          yield edge;
        }
      }
    }
  }
  *getNodeEdgesByType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    node: unknown,
    type: string,
    direction: EdgeDirection,
  ): Iterable<unknown> {
    for (const edge of graph[
      direction === 'in'
        ? 'inEdges'
        : direction === 'out'
          ? 'outEdges'
          : 'edges'
    ](node)) {
      if (graph.getEdgeAttribute(edge, 'type') === type) {
        yield edge;
      }
    }
  }
  *filterNodeEdges(
    graph: MultiDirectedGraph,
    node: unknown,
    direction: EdgeDirection,
    predicate?: (node: unknown, edge: unknown) => boolean,
  ): Iterable<unknown> {
    for (const edge of graph[
      direction === 'in'
        ? 'inEdges'
        : direction === 'out'
          ? 'outEdges'
          : 'edges'
    ](node)) {
      if (!predicate || predicate(node, edge)) {
        yield edge;
      }
    }
  }
  getNodeProperty(
    graph: MultiDirectedGraph,
    node: unknown,
    property: string,
  ): unknown {
    return graph.getNodeAttribute(node, property);
  }
  getEdgeProperty(
    graph: MultiDirectedGraph,
    edge: unknown,
    property: string,
  ): unknown {
    return graph.getEdgeAttribute(edge, property);
  }

  getNodeProperties(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    node: any,
  ): Record<string, unknown> {
    return graph.getNodeAttributes(node);
  }
  getEdgeProperties(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    edge: any,
  ): Record<string, unknown> {
    return graph.getEdgeAttributes(edge);
  }

  isConnected(
    graph: MultiDirectedGraph,
    edge: unknown,
    node: unknown,
    direction: EdgeDirection,
  ): boolean {
    return graph[
      direction === 'in'
        ? 'inNeighbors'
        : direction === 'out'
          ? 'outNeighbors'
          : 'neighbors'
    ](node).includes(edge as any);
  }
  hasLabel(
    graph: MultiDirectedGraph<
      Attributes & { labels: string[] },
      Attributes & { type: string },
      Attributes
    >,
    node: unknown,
    label: string,
  ): boolean {
    return graph.getNodeAttribute(node, 'labels')?.includes(label) ?? false;
  }
  hasType(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    edge: unknown,
    type: string,
  ): boolean {
    return graph.getEdgeAttribute(edge, 'type') === type;
  }
  getEdgeNode(
    graph: MultiDirectedGraph<
      Attributes,
      Attributes & { type: string },
      Attributes
    >,
    edge: unknown,
    type: 'source' | 'target',
  ) {
    return graph[type](edge);
  }
}
