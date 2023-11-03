# This is example use `kexp` with AWS EKS

## Create kubeconfig via `aws-cli`
```bash
export YOUR_EKS_NAME="REPLACE_ME"
export YOUR_EKS_REGION="REPLACE_ME"
aws eks update-kubeconfig --name ${YOUR_EKS_NAME} --region ${YOUR_EKS_REGION} --kubeconfig ~/demo-kexp.config


--- output ---
Added new context arn:aws:eks:${YOUR_EKS_REGION}:your-account:cluster/${YOUR_EKS_NAME} to ~/demo-kexp.config
```

## Create service account to access eks cluster.
1. create service account `viewer-sa`.
```bash
echo '
apiVersion: v1
kind: ServiceAccount
metadata:
  namespace: default
  name: viewer-sa' | kubectl apply -f -
```
```bash
--- output ---
serviceaccount/viewer-sa created
```
2. Binding cluster-role view to service account viewer-sa.
```bash
echo '
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: viewer-sa-cluster-role-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view
subjects:
- kind: ServiceAccount
  namespace: default
  name: viewer-sa' | kubectl apply -f -
```
```bash
--- output ---
clusterrolebinding.rbac.authorization.k8s.io/viewer-sa-cluster-role-binding created
```
3. Get viewer-sa token (default expired after 1h).
   - copy the output `jwt` token.
```bash
## 1h expired.
kubectl create token viewer-sa -n default
```
```bash
--- output ---
eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3MGJlMjFiOTc4YmZhZjAzZTBlODBiMWIzODcexampleexampleexampleexample.exampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexample.exampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexample-EX4xANwa_HjqgT5BBgObWa1wFhH4kAS2ULpnzioLyDex46wfxPq13OeHZIcXE9EwBERO4g8Wr2R0_PQ
```
  - EKS limit token only setting duration 1d(24h).
    ```bash
    ## EKS limit token only setting duration 1d(24h).
    export JWT=$(kubectl create token viewer-sa --duration 24h)
    ```

  - If you request over 1d, you will get this warning message.
    ```bash
    kubectl create token viewer-sa --duration 100h
    Warning: requested expiration of 360000 seconds shortened to 86400 seconds
    ```
4. update `~/demo-kexp.config`
   - replace `users.[0].user.exec` to `users.[0].user.token`
before:
  -  🚨 🚨 🚨 please replcae `arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME` -> `$EKS_CLUSTER_NAME`  🚨 🚨 🚨
```bash
   apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: EXAMPLE0FURS0tLS0tCk1JSURCVENDQWUyZ0F3SUJBZ0lJUkEvREYrQjl6Q0F3RFFZSktvWklodmNOQVFFTEJRQXdGVEVUTUJFR0ExVUUKQXhNS2EzVmlaWEp1WlhSbGN6QWVGdzB5TXpFd01qUXdPREkxTVRaYUZ3MHpNekV3TWpFd09ETXdNVFphTUJVeApFekFSQmdOVkJBTVRDbXQxWW1WeWJtVjBaWE13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLCkFvSUJBUUNaakd6djFYcXVHMFVDUWFsRzg2aGUrOEtjMDVsTGN3QUhRdy9XeGtZZzAwRWNrRXFqQmNkQ1laL2EKYXJ6TXhISUJvbVJRMjgwbG9xQUx5azdMWmZYK1NaTjEvSVcyMnY0UC9kcmRiZjN1WXFFTjRRN2RoQ1h6VlJ0dwpTQUJKUEpqbVRDNldpZHlVZ0ZxUFpJNndJT2IyemhsSGJWa3MzditUL1JXV2xmbm5oL0gxL2dMb0VQUUpwTFg4CjNiNFJXNWYzdGRZNEFJcHlheVBWNW1Eb29XRVlRcWVMYzdrcDVvSU8xQTVDNk9ZSDgwbXJobDZoNzNwN2lTb2MKb1Y3RjY3UnZDVnN5NE9ZcnMrWXkreHlHQ3A3RlVUdUMrSEw4Wlc2ekIyUkZadGNNVUtIYkxXMUw4cGpWblFwNAorSDM4aEt4OWhmdFVRYVNCK004NThUK1d0YlhQQWdNQkFBR2pXVEJYTUE0R0ExVWREd0VCL3dRRUF3SUNwREFQCkJnTlZIUk1CQWY4RUJUQURBUUgvTUIwR0ExVWREZ1EXAMPLEcGl2YklPNWphWFFTc1lHWGRtLzNEQVYKQmdOVkhSRUVEakFNZ2dwcmRXSmxjbTVsZEdWek1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQXJsMVNYenJNeApSbWlWYmMyaFdOOFhSbHpXa3AxM3hsS1JVZlZFU09FMVg4WVVvTGxaNTZvZTdZWGZ1cVd0UGR5TE41SDNCcU1FCjZtWGRMYWpRN0NJclZCTHhia3B6YmNkUWM4U0NQdXJNdjB6R2JQd1BMdzFpb2dZYTJLM2crRUlrZmJlZThzM3oKZVZSTCs5R0szNXNRZVNocFRxMTJmdEXAMPLEcXZOaW9PUytrUVFwbmNiWXUxS3loSktZazFEd2l6SDYwbgptRlFvRGRpN1hzNFZsaWVZSFVlNXk0MjlFUFd5akJCYWd3NWxReEJsaGdQOHYyb1Fwd3VUbUtHQ2JDUytYSzB6CnQ1UGZ5UlkwZzBaeUExWnNFUnJpenlyb1N0QTM2ellvUHZRblRwNnVHdTBDRTlwWW41bklhYjRqR2RxQW1XaUkKbzVvSUsyclp0NTJECi0tLS0tRU5EIENFUlREXAMPLEXAMPLE
    server: https://EXAMPLEEXAMPLEEXAMPLE.gr7.AWS_REGION.eks.amazonaws.com
  name: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME  
contexts:
- context:
    cluster: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME
    user: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME 
  name: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME 
current-context: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME
kind: Config
preferences: {}
users:
- name: arn:aws:eks:AWS_REGION:ACCOUNT_ID:cluster/$EKS_CLUSTER_NAME 
  user:    
    exec:  <--- The part to replace --->
      apiVersion: client.authentication.k8s.io/v1beta1
      args:
      - --region
      - AWS_REGION
      - eks
      - get-token
      - --cluster-name
      - $EKS_CLUSTER_NAME
      - --output
      - json
      command: aws
```
after:
```bash
apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: EXAMPLE0FURS0tLS0tCk1JSURCVENDQWUyZ0F3SUJBZ0lJUkEvREYrQjl6Q0F3RFFZSktvWklodmNOQVFFTEJRQXdGVEVUTUJFR0ExVUUKQXhNS2EzVmlaWEp1WlhSbGN6QWVGdzB5TXpFd01qUXdPREkxTVRaYUZ3MHpNekV3TWpFd09ETXdNVFphTUJVeApFekFSQmdOVkJBTVRDbXQxWW1WeWJtVjBaWE13Z2dFaU1BMEdDU3FHU0liM0RRRUJBUVVBQTRJQkR3QXdnZ0VLCkFvSUJBUUNaakd6djFYcXVHMFVDUWFsRzg2aGUrOEtjMDVsTGN3QUhRdy9XeGtZZzAwRWNrRXFqQmNkQ1laL2EKYXJ6TXhISUJvbVJRMjgwbG9xQUx5azdMWmZYK1NaTjEvSVcyMnY0UC9kcmRiZjN1WXFFTjRRN2RoQ1h6VlJ0dwpTQUJKUEpqbVRDNldpZHlVZ0ZxUFpJNndJT2IyemhsSGJWa3MzditUL1JXV2xmbm5oL0gxL2dMb0VQUUpwTFg4CjNiNFJXNWYzdGRZNEFJcHlheVBWNW1Eb29XRVlRcWVMYzdrcDVvSU8xQTVDNk9ZSDgwbXJobDZoNzNwN2lTb2MKb1Y3RjY3UnZDVnN5NE9ZcnMrWXkreHlHQ3A3RlVUdUMrSEw4Wlc2ekIyUkZadGNNVUtIYkxXMUw4cGpWblFwNAorSDM4aEt4OWhmdFVRYVNCK004NThUK1d0YlhQQWdNQkFBR2pXVEJYTUE0R0ExVWREd0VCL3dRRUF3SUNwREFQCkJnTlZIUk1CQWY4RUJUQURBUUgvTUIwR0ExVWREZ1EXAMPLEcGl2YklPNWphWFFTc1lHWGRtLzNEQVYKQmdOVkhSRUVEakFNZ2dwcmRXSmxjbTVsZEdWek1BMEdDU3FHU0liM0RRRUJDd1VBQTRJQkFRQXJsMVNYenJNeApSbWlWYmMyaFdOOFhSbHpXa3AxM3hsS1JVZlZFU09FMVg4WVVvTGxaNTZvZTdZWGZ1cVd0UGR5TE41SDNCcU1FCjZtWGRMYWpRN0NJclZCTHhia3B6YmNkUWM4U0NQdXJNdjB6R2JQd1BMdzFpb2dZYTJLM2crRUlrZmJlZThzM3oKZVZSTCs5R0szNXNRZVNocFRxMTJmdEXAMPLEcXZOaW9PUytrUVFwbmNiWXUxS3loSktZazFEd2l6SDYwbgptRlFvRGRpN1hzNFZsaWVZSFVlNXk0MjlFUFd5akJCYWd3NWxReEJsaGdQOHYyb1Fwd3VUbUtHQ2JDUytYSzB6CnQ1UGZ5UlkwZzBaeUExWnNFUnJpenlyb1N0QTM2ellvUHZRblRwNnVHdTBDRTlwWW41bklhYjRqR2RxQW1XaUkKbzVvSUsyclp0NTJECi0tLS0tRU5EIENFUlREXAMPLEXAMPLE
    server: https://example.gr7.AWS_REGION.eks.amazonaws.com
  name: $EKS_CLUSTER_NAME
contexts:
- context:
    cluster: $EKS_CLUSTER_NAME
    user: $EKS_CLUSTER_NAME
  name: $EKS_CLUSTER_NAME
current-context: $EKS_CLUSTER_NAME
kind: Config
preferences: {}
users:
- name: $EKS_CLUSTER_NAME
  user:
    token: eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3MGJlMjFiOTc4YmZhZjAzZTBlODBiMWIzODcexampleexampleexampleexample.exampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexample.exampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexampleexample-EX4xANwa_HjqgT5BBgObWa1wFhH4kAS2ULpnzioLyDex46wfxPq13OeHZIcXE9EwBERO4g8Wr2R0_PQ
```

## Running the `kexp` with custom kubeconfig.
```bash

kexp --host 0.0.0.0 --port 8090 --kubeconfig ~/demo-kexp.config


--- output ---
{"contexts":[{}],"level":"debug","msg":"Kube context discovery finished","time":"2023-11-03T09:58:37+08:00"}
{"level":"info","msg":"Starting server on 0.0.0.0:8090","time":"2023-11-03T09:58:37+08:00"}
[GIN-debug] [WARNING] Running in "debug" mode. Switch to "release" mode in production.
 - using env:   export GIN_MODE=release
 - using code:  gin.SetMode(gin.ReleaseMode)

[GIN-debug] GET    /api/kube/v1/contexts/    --> github.com/iximiuz/kexp/api/rest/kube/contexts.(*Handler).List-fm (3 handlers)
[GIN-debug] GET    /api/kube/v1/contexts/:ctx/resources/ --> github.com/iximiuz/kexp/api/rest/kube/resources.(*Handler).List-fm (3 handlers)
[GIN-debug] GET    /api/kube/v1/contexts/:ctx/resources/:group/:version/:resource/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).List-fm (3 handlers)
[GIN-debug] GET    /api/kube/v1/contexts/:ctx/resources/:group/:version/namespaces/:namespace/:resource/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).List-fm (3 handlers)
[GIN-debug] GET    /api/kube/v1/contexts/:ctx/resources/:group/:version/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Get-fm (3 handlers)
[GIN-debug] GET    /api/kube/v1/contexts/:ctx/resources/:group/:version/namespaces/:namespace/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Get-fm (3 handlers)
[GIN-debug] PUT    /api/kube/v1/contexts/:ctx/resources/:group/:version/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Update-fm (3 handlers)
[GIN-debug] PUT    /api/kube/v1/contexts/:ctx/resources/:group/:version/namespaces/:namespace/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Update-fm (3 handlers)
[GIN-debug] DELETE /api/kube/v1/contexts/:ctx/resources/:group/:version/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Delete-fm (3 handlers)
[GIN-debug] DELETE /api/kube/v1/contexts/:ctx/resources/:group/:version/namespaces/:namespace/:resource/:name/ --> github.com/iximiuz/kexp/api/rest/kube/objects.(*Handler).Delete-fm (3 handlers)
[GIN-debug] GET    /api/stream/v1/           --> github.com/iximiuz/kexp/api/stream.(*Handler).Connect-fm (3 handlers)
[GIN-debug] GET    /ui/*filepath             --> github.com/gin-gonic/gin.(*RouterGroup).createStaticHandler.func1 (3 handlers)
[GIN-debug] HEAD   /ui/*filepath             --> github.com/gin-gonic/gin.(*RouterGroup).createStaticHandler.func1 (3 handlers)
[GIN-debug] GET    /                         --> main.run.func1.1 (3 handlers)
[GIN-debug] [WARNING] You trusted all proxies, this is NOT safe. We recommend you to set a value.
Please check https://pkg.go.dev/github.com/gin-gonic/gin#readme-don-t-trust-all-proxies for details.
[GIN-debug] Listening and serving HTTP on 0.0.0.0:8090
[GIN] 2023/11/03 - 09:58:42 | 200 |    4.464041ms |             ::1 | GET      "/ui/"
[GIN] 2023/11/03 - 09:58:42 | 200 |     126.209µs |             ::1 | GET      "/ui/fonts/inter/inter.css"
[GIN] 2023/11/03 - 09:58:42 | 200 |    1.163834ms |             ::1 | GET      "/ui/assets/index-1d5c257f.css"
[GIN] 2023/11/03 - 09:58:42 | 200 |       3.788ms |             ::1 | GET      "/ui/assets/index-bc11076a.js"
[GIN] 2023/11/03 - 09:58:42 | 200 |     297.459µs |             ::1 | GET      "/api/kube/v1/contexts/"
[GIN] 2023/11/03 - 09:58:42 | 200 |  234.169167ms |             ::1 | GET      "/api/kube/v1/contexts/aws-eks-cluster-name/resources/"
[GIN] 2023/11/03 - 09:58:42 | 200 |      89.917µs |             ::1 | GET      "/ui/logos/github.png"
[GIN] 2023/11/03 - 09:58:42 | 200 |     1.35875ms |             ::1 | GET      "/ui/fonts/inter/Inter-roman.var.woff2?v=3.19"
```