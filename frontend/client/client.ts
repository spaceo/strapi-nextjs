import { Chain } from "../zeus";

// TODO: get token via process.env.
const token =
    "82d09b077315baea9bb78e05c0f382c1a214c5570c69bf779aa5d22f1e7193263817b72ae9920c1e606ae65318753af958e1818901234da89b5820ed37885b94b0ad87014902c833c70a06ed08fc9fc87813ee10ce8b1e42b46293e6d2688277dfe8af61565dbcccff7f007d66bc5e5ea225d1c95d30d14f04a3e23846129c82";
  export default Chain("http://127.0.0.1:1337/graphql", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });