import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

@object()
class DaggerDemo {
  @func()
  async publish(source: Directory): Promise<string> {
    // await this.test(source)
    return await this.build(source).publish(
      "ttl.sh/myapp-" + Math.floor(Math.random() * 10000000)
    );
  }

  @func()
  build(source: Directory): Container {
    const build = this.buildEnv(source)
      .withExec(["npm", "run", "build"])
      .directory("./build");
    return dag
      .container()
      .from("nginx:1.25-alpine")
      .withDirectory("/usr/share/nginx/html", build)
      .withExposedPort(80);
  }

  @func()
  async test(source: Directory): Promise<string> {
    return this.buildEnv(source).withExec(["npm", "run", "test"]).stdout();
  }

  @func()
  buildEnv(source: Directory): Container {
    const nodeCache = dag.cacheVolume("node");
    return dag
      .container()
      .from("node:21-slim")
      .withDirectory("/src", source)
      .withMountedCache("/src/node_modules", nodeCache)
      .withWorkdir("/src")
      .withExec(["npm", "install"]);
  }

  @func()
  uploadToS3(source: Directory): Container {
    const build = this.buildEnv(source)
      .withExec(["npm", "run", "build"])
      .directory("./build");

    return dag
      .container()
      .from("nginx:1.25-alpine")
      .withExec(["apk", "update"])
      .withExec(["apk", "add", "--no-cache", "zip", "aws-cli"])
      .withDirectory("/app/build", build)
      .withExec(["zip", "-r", "build.zip", "/app/build"])
      .withEnvVariable("AWS_ACCESS_KEY_ID", "")
      .withEnvVariable(
        "AWS_SECRET_ACCESS_KEY",
        ""
      )
      .withEnvVariable("AWS_DEFAULT_REGION", "us-east-2")
      .withExec([
        "sh",
        "-c",
        "timestamp=$(date +%Y-%m-%d_%H-%M-%S) && aws s3 cp build.zip s3://dagger-demo-bucket/build_$timestamp.zip",
      ]);
  }
}
