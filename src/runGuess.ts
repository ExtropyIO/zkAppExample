import * as readline from 'readline';
import {
  Field,
  isReady,
  Mina,
  Party,
  PrivateKey,
  UInt64,
  shutdown,
  Permissions,
} from 'snarkyjs';
import { Guess } from './guess.js';

let rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function askQuestion(theQuestion: string): Promise<string> {
  return new Promise((resolve) =>
    rl.question(theQuestion, (answ) => resolve(answ))
  );
}

export async function run() {
  await isReady;
  // initilize local blockchain
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  // the mock blockchain gives you access to 10 accounts
  const deployerAcc = Local.testAccounts[0].privateKey;
  const ownerAcc = Local.testAccounts[1].privateKey;
  const playerAcc = Local.testAccounts[2].privateKey;

  const zkAppPrivkey = PrivateKey.random();
  const zkAppAddress = zkAppPrivkey.toPublicKey();

  const zkAppInstance = new Guess(zkAppAddress);

  //transaction to deploy the smart contract and init it's values
  const txn = await Mina.transaction(deployerAcc, () => {
    const initialBalance = UInt64.fromNumber(1000000000);
    Party.fundNewAccount(deployerAcc, { initialBalance: initialBalance });
    zkAppInstance.deploy({ zkappKey: zkAppPrivkey });
    zkAppInstance.setPermissions({
      ...Permissions.default(),
      editState: Permissions.none(),
      receive: Permissions.none(),
      send: Permissions.none(),
    });
    let potValue = Field(10000);
    zkAppInstance.init(initialBalance, ownerAcc.toPublicKey(), potValue);
  });
  await txn.send().wait();

  console.log(
    'snapp balance after deployment: ',
    Mina.getBalance(zkAppAddress).toString()
  );

  console.log(
    'owner balance before starting round: ',
    Mina.getBalance(ownerAcc.toPublicKey()).toString()
  );
  console.log('Owner starts the round');
  let guess = await askQuestion('what should be the secret number? \n');
  const txn2 = await Mina.transaction(ownerAcc, () => {
    zkAppInstance.startRound(Field(guess), ownerAcc);
  });
  await txn2.send().wait();
  console.log(
    'owner balance after starting round: ',
    Mina.getBalance(ownerAcc.toPublicKey()).toString()
  );
  await sleep(1000);
  console.log('Switching to user 2 in 3 sec...');
  await sleep(1000);
  console.log('2 sec ...');
  await sleep(1000);
  console.log('1 sec ...');
  await sleep(1000);
  console.clear();

  console.log(
    'Player starting balance  ',
    Mina.getBalance(playerAcc.toPublicKey()).toString()
  );
  console.log(
    'hash of the guess is:',
    zkAppInstance.hashOfGuess.get().toString()
  );
  let usersGuess = await askQuestion('Hey user2, what is your guess? \n');
  try {
    const txn = await Mina.transaction(playerAcc, () => {
      zkAppInstance.submitGuess(Field(usersGuess));
    });
    await txn.send().wait();

    console.log('Correct guess but ...');
  } catch {
    console.log('Wrong guess!!');
    throw new Error();
  }
  console.log('Validate that you are not a robot 🤖🤖🤖');
  let multipliedValue = await askQuestion('your guess multiplied by 3 is : \n');

  try {
    const txn3 = await Mina.transaction(playerAcc, () => {
      zkAppInstance.guessMultiplied(
        Field(usersGuess),
        Field(multipliedValue),
        playerAcc.toPublicKey()
      );
    });
    await txn3.send().wait();
    console.log('correct!');
    console.log(
      'Player balance after correct guess ',
      Mina.getBalance(playerAcc.toPublicKey()).toString()
    );
    console.log(
      'snapp balance after payout: ',
      Mina.getBalance(zkAppAddress).toString()
    );
  } catch (e) {
    console.log(e);
    console.log("wrong, you're a robot!");
  }
}

(async function () {
  await run();
  await shutdown();
})();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
