# profekto

Demo project exploring backend/frontend architecture with Strapi and NextJs.

## Up and Running

### Prerequisites

+ Node and Npm
+ Yarn

### Get backend up

#### Enter backend
```bash
cd backend
```

#### Prepare backend
```bash
yarn
yarn develop
```

#### Import data
```bash
npx strapi import --force -f exports/export_20230601225759.tar.gz
```

#### Run backend
```bash
yarn develop
```

#### Login to Strapi
Go to http://localhost:1337/admin and login

### Get frontend up

#### Enter frontend
```bash
cd frontend
```

#### Prepare frontend
```bash
yarn
yarn dev
```

#### Visit frontend
Go to http://localhost:3000