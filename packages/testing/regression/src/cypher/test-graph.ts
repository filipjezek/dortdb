import { gaLabelsOrType } from '@dortdb/lang-cypher';
import { MultiDirectedGraph } from 'graphology';

/**
 * Small social graph shared by the Cypher regression specs:
 *   (Alice:Person {age: 30})-[:KNOWS {since: 2010}]->(Bob:Person {age: 20})
 *   (Bob)-[:KNOWS {since: 2015}]->(Carol:Person:Admin)
 *   (Alice)-[:WORKS_AT]->(Acme:Company)<-[:WORKS_AT]-(Carol)
 */
export function createSocialGraph(): MultiDirectedGraph {
  const graph = new MultiDirectedGraph();
  graph.addNode('alice', {
    [gaLabelsOrType]: ['Person'],
    name: 'Alice',
    age: 30,
  });
  graph.addNode('bob', { [gaLabelsOrType]: ['Person'], name: 'Bob', age: 20 });
  graph.addNode('carol', {
    [gaLabelsOrType]: ['Person', 'Admin'],
    name: 'Carol',
  });
  graph.addNode('acme', { [gaLabelsOrType]: ['Company'], name: 'Acme' });
  graph.addEdge('alice', 'bob', { [gaLabelsOrType]: 'KNOWS', since: 2010 });
  graph.addEdge('bob', 'carol', { [gaLabelsOrType]: 'KNOWS', since: 2015 });
  graph.addEdge('alice', 'acme', { [gaLabelsOrType]: 'WORKS_AT' });
  graph.addEdge('carol', 'acme', { [gaLabelsOrType]: 'WORKS_AT' });
  return graph;
}
