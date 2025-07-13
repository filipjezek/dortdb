import { ExtractedFileOptions } from './zip/zip-extractor.js';
import { type GraphologyGraph } from '@dortdb/lang-cypher';

export interface UnibenchData {
  customers: Record<string, any>[];
  invoices: Document;
  orders: Record<string, any>[];
  feedback: Record<string, any>[];
  products: Record<string, any>[];
  brandProducts: Record<string, any>[];
  vendors: Record<string, any>[];
  socialNetwork: GraphologyGraph;
  posts: Record<string, any>[];
}
export type UnibenchObjectKeys = keyof {
  [K in keyof UnibenchData as UnibenchData[K] extends Record<string, any>[]
    ? K
    : never]: any;
};

const graphOptions: ExtractedFileOptions = {
  type: 'graph',
  csvOptions: {
    separator: '|',
    cast: true,
    columns: undefined,
  },
};
export const unibenchFiles: Record<string, ExtractedFileOptions> = {
  'Dataset/Customer/person_0_0.csv': {
    key: 'customers',
    type: 'csv',
    csvOptions: {
      cast: {
        id: Number,
        birthday: (v: string) => new Date(v),
        creationDate: (v: string) => new Date(v),
        place: Number,
      },
      separator: '|',
      columns: true,
    },
  },
  'Dataset/Feedback/Feedback.csv': {
    key: 'feedback',
    type: 'csv',
    csvOptions: {
      cast: {
        personId: Number,
      },
      columns: ['productAsin', 'personId', 'feedback'],
      separator: '|',
    },
  },
  'Dataset/Product/BrandByProduct.csv': {
    key: 'brandProducts',
    type: 'csv',
    csvOptions: {
      columns: ['brandName', 'productAsin'],
    },
  },
  'Dataset/Product/Product.csv': {
    key: 'products',
    type: 'csv',
    csvOptions: {
      cast: {
        price: Number,
        productId: Number,
        brand: Number,
      },
      columns: true,
    },
  },
  'Dataset/Vendor/Vendor.csv': {
    key: 'vendors',
    type: 'csv',
    csvOptions: { columns: true },
  },
  'Dataset/SocialNetwork/post_0_0.csv': {
    key: 'posts',
    type: 'csv',
    csvOptions: {
      cast: { id: Number, creationDate: (v: string) => new Date(v) },
      separator: '|',
      columns: true,
    },
  },
  'Dataset/Invoice/Invoice.xml': {
    type: 'xml',
    key: 'invoices',
  },
  'Dataset/Order/Order.json': {
    type: 'ndjson',
    key: 'orders',
  },
  'Dataset/SocialNetwork/person_hasInterest_tag_0_0.csv': graphOptions,
  'Dataset/SocialNetwork/person_knows_person_0_0.csv': graphOptions,
  'Dataset/SocialNetwork/post_hasCreator_person_0_0.csv': graphOptions,
  'Dataset/SocialNetwork/post_hasTag_tag_0_0.csv': graphOptions,
};

export const unibenchGraphTables: Record<string, UnibenchObjectKeys> = {
  person: 'customers',
  post: 'posts',
};
