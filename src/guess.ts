import {
  Field,
  PublicKey,
  SmartContract,
  state,
  State,
  Party,
  PrivateKey,
  method,
  UInt64,
  Poseidon,
} from 'snarkyjs';

export class Guess extends SmartContract {
  @state(Field) hashOfGuess = State<Field>();
  @state(PublicKey) ownerAddr = State<PublicKey>();
  pot = UInt64.zero;

  // deploy(args: DeployArgs) {
  //   super.deploy(args);
  //   this.setPermissions({
  //     ...Permissions.default(),
  //     editState: Permissions.proof(),
  //   });
  // }

  @method init(initialbalance: UInt64, ownerAddr: PublicKey, potValue: Field) {
    this.ownerAddr.set(ownerAddr);
    this.balance.addInPlace(initialbalance);
    this.pot = new UInt64(potValue);
  }

  @method startRound(numberToGuess: Field, callerPrivKey: PrivateKey) {
    let ownerAddr = this.ownerAddr.get();
    let callerAddr = callerPrivKey.toPublicKey();
    callerAddr.assertEquals(ownerAddr);
    let callerParty = Party.createSigned(callerPrivKey);
    callerParty.balance.subInPlace(this.pot);
    this.balance.addInPlace(this.pot);
    this.hashOfGuess.set(Poseidon.hash([numberToGuess.add(this.pot.value)]));
  }
  //another way to do access control
  // @method startRound(x: Field, signature: Signature, guess: Field) {
  //   let ownerAddr = this.ownerAddr.get();
  //   signature.verify(ownerAddr, [x]).assertEquals(true);
  //   this.hashOfGuess.set(Poseidon.hash([guess]));
  // }

  @method submitGuess(guess: Field) {
    let userHash = Poseidon.hash([guess.add(this.pot.value)]);
    let stateHash = this.hashOfGuess.get();
    stateHash.assertEquals(userHash);
  }

  @method guessMultiplied(guess: Field, result: Field, callerAddr: PublicKey) {
    const onChainHash = this.hashOfGuess.get();
    onChainHash.assertEquals(Poseidon.hash([guess.add(this.pot.value)]));
    let multiplied = Field(guess).mul(3);
    multiplied.assertEquals(result);
    this.balance.subInPlace(this.pot);
    let userParty = Party.createUnsigned(callerAddr);
    userParty.balance.addInPlace(this.pot);
  }
}
