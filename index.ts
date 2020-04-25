import * as Git from "nodegit"

import * as fs from "fs"

import * as util from "util"

import * as openpgp from "openpgp"

// Add createCommitWithSignature(updateRef: string, author: Signature, committer: Signature, message: string, Tree: Tree | Oid | string, parents: Array<string | Commit | Oid>, onSignature: Function, callback?: Function): Promise<Oid>;
// to node_modules/@types/nodegit/repository.d.ts

const rmdir = util.promisify(fs.rmdir)
const mkdir = util.promisify(fs.mkdir)
const writeFile = util.promisify(fs.writeFile)
const readFile = util.promisify(fs.readFile)

async function GitTest() {
  const recursive = true

  await rmdir("test", { recursive })

  await mkdir("test")

  const helloWorld = new Uint8Array(Buffer.from("Hello world"))

  await writeFile('test/README.md', helloWorld)

  const privateKeyArmored = await readFile("test_private.pgp", "utf8")

  const { keys: [privateKey] } = await openpgp.key.readArmored(privateKeyArmored)

  const repository = await Git.Repository.init("test", 0)

  const author = Git.Signature.now("whs", "hswongac@gmail.com")
  const committor = Git.Signature.now("whs", "hswongac@gmail.com")

  const index = await repository.refreshIndex()

  await index.addByPath("README.md")

  await index.write()

  const treeOid = await index.writeTree()

  async function onSignature(commitContent) {
    const buf = Buffer.from(commitContent)

    const options = {
      message: openpgp.message.fromBinary(buf),
      privateKeys: [privateKey],
      detached: true
    }

    const { signature: signedData } = await openpgp.sign(options);

    return {
      code: Git.Error.CODE.OK,
      field: 'gpgsig',
      signedData
    }
  }

  await repository.createCommitWithSignature("HEAD", author, committor, "First commit", treeOid, [], onSignature)

  const remote = await Git.Remote.create(repository, "origin", "git@github.com:whs-dot-hk/nodegit-test.git")

  const options = {
    callbacks: {
      credentials: (_, username) => Git.Cred.sshKeyNew(username, "test_key.pub", "test_key", "")
    }
  }

  await remote.push(["+refs/heads/master:refs/heads/master"], options)
}

GitTest()
