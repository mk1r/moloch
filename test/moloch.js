const fse = require('fs-extra')

const Moloch = artifacts.require('./Moloch')
const GuildBank = artifacts.require('./GuildBank')
const TestCoin = artifacts.require('./TestCoin')
const foundersJSON = require('../migrations/founders.json')

contract('verify up to deployment', accounts => {
  let moloch, founders

  before('deploy contracts', async () => {
    moloch = await Moloch.deployed()
    founders = foundersJSON
  })
  // verify founding members
  it('should save addresses from deploy', async () => {
    for (let i = 0; i < founders.addresses.length; i++) {
      let memberAddress = founders.addresses[i]
      const member = await moloch.getMember(memberAddress)
      assert.equal(member, true, 'founding member not saved correctly')
    }
  })
  // verify failure of non-founding members
  it('should fail non deployed addresses', async () => {
    for (let i = 2; i < 10; i++) {
      let nonMemberAddress = accounts[i]
      const nonMember = await moloch.getMember(nonMemberAddress)
      assert.notEqual(nonMember, true, 'non-member added incorrectly')
    }
  })
  // verify founding member shares
  it('should save founder shares from deploy', async () => {
    for (let i = 0; i < founders.addresses.length; i++) {
      let memberAddress = founders.addresses[i]
      const memberShares = await moloch.getVotingShares(memberAddress)
      assert.equal(
        founders.shares[i],
        memberShares.toNumber(),
        'founding shares not saved correctly'
      )
    }
  })
  // verify failure of incorrect shares
  it('should fail on incorrect shares', async () => {
    for (let i = 0; i < founders.addresses.length; i++) {
      let memberAddress = founders.addresses[i]
      const memberShares = await moloch.getVotingShares(memberAddress)
      assert.notEqual(
        parseInt(Math.random() * 1000),
        memberShares.toNumber(),
        'incorrect shares saved'
      )
    }
  })
})

contract('donate', accounts => {
  let moloch, guildBank, guildBankAddress

  before('deploy Moloch', async () => {
    moloch = await Moloch.deployed()
    guildBankAddress = await moloch.getGuildBank.call()
    guildBank = await GuildBank.at(guildBankAddress)
  })

  it('donate ETH', async () => {
    await guildBank.sendTransaction({ from: accounts[0], value: 100 })
    const balance = await web3.eth.getBalance(guildBankAddress)
    assert.equal(
      100,
      balance.toNumber(),
      'transaction sent does not equal balance in Guild Bank'
    )
  })

  it('donate tokens', async () => {
    const token = await TestCoin.deployed()
    await token.approve(guildBank.address, 10000000, {
      from: accounts[0]
    })
    await guildBank.offerTokens(accounts[0], token.address, 10000000, {
      from: accounts[0]
    })
    const tokenBalance = await token.balanceOf(guildBankAddress)
    assert.equal(
      tokenBalance,
      10000000,
      'token donation amount does not equal guild bank balance'
    )
    const tokenAddresses = await guildBank.getTokenAddresses.call()
    assert.equal(
      tokenAddresses[0],
      token.address,
      'token address not added to guild bank list'
    )
  })
})

contract('member application', accounts => {
  let moloch, guildBank, guildBankAddress
  const PROSPECTIVE_MEMBERS = [accounts[9], accounts[8]]
  const VOTING_SHARES_REQUESTED = 1000
  const FOUNDER_ADDRESSES = foundersJSON.addresses
  const TRIBUTE = 10000
  const PROPOSAL_PHASES = {
    Done: 0,
    Proposed: 1,
    Voting: 2,
    GracePeriod: 3
  }
  const PROPOSAL_TYPES = {
    Membership: 0,
    Project: 1
  }

  before('deploy Moloch', async () => {
    moloch = await Moloch.deployed()
    guildBankAddress = await moloch.getGuildBank.call()
    guildBank = await GuildBank.at(guildBankAddress)
  })

  it('member application ETH', async () => {
    await moloch.createMemberProposal(
      PROSPECTIVE_MEMBERS[0],
      [],
      [],
      VOTING_SHARES_REQUESTED,
      {
        from: FOUNDER_ADDRESSES[0],
        value: TRIBUTE
      }
    )

    const currentProposalIndex = await moloch.getCurrentProposalIndex.call()
    const [
      proposer,
      proposalType,
      votingSharesRequested,
      phase
    ] = await moloch.getProposalCommonDetails.call(currentProposalIndex)
    assert.equal(
      proposer,
      FOUNDER_ADDRESSES[0],
      `proposer is not ${FOUNDER_ADDRESSES[0]}`
    )
    assert.equal(
      proposalType,
      PROPOSAL_TYPES.Membership,
      `proposal types is not "Membership"`
    )
    assert.equal(
      votingSharesRequested,
      VOTING_SHARES_REQUESTED,
      `voting shares requested is not ${VOTING_SHARES_REQUESTED}`
    )
    assert.equal(
      phase,
      PROPOSAL_PHASES.Proposed,
      `proposal phase is not "Proposed"`
    )

    const [
      prospectiveMemberAddress,
      ethTributeAmount,
      tokenTributeAddresses,
      tokenTributeAmounts
    ] = await moloch.getProposalMemberDetails.call(currentProposalIndex)
    assert.equal(
      prospectiveMemberAddress,
      PROSPECTIVE_MEMBERS[0],
      `Prospective member address not correct`
    )
    assert.equal(ethTributeAmount, TRIBUTE, `eth tribute amount incorrect`)
    assert.equal(
      tokenTributeAddresses,
      false,
      `should not be any token tribute`
    )
    assert.equal(tokenTributeAmounts, false, `should not be any token tribute`)
  })

  it('member application tokens', async () => {
    const token = await TestCoin.deployed()
    await token.approve(guildBank.address, TRIBUTE, {
      from: PROSPECTIVE_MEMBERS[1]
    })
    await token.allowance(PROSPECTIVE_MEMBERS[1], guildBank.address)

    await moloch.createMemberProposal(
      PROSPECTIVE_MEMBERS[1],
      [token.address],
      [TRIBUTE],
      VOTING_SHARES_REQUESTED,
      {
        from: FOUNDER_ADDRESSES[0]
      }
    )

    const currentProposalIndex = await moloch.getCurrentProposalIndex.call()
    console.log(
      'currentProposalIndex: ',
      currentProposalIndex.plus(1).toNumber()
    )
    const [
      proposer,
      proposalType,
      votingSharesRequested,
      phase
    ] = await moloch.getProposalCommonDetails.call(1)
    assert.equal(
      proposer,
      FOUNDER_ADDRESSES[0],
      `proposer is not ${FOUNDER_ADDRESSES[0]}`
    )
    assert.equal(
      proposalType,
      PROPOSAL_TYPES.Membership,
      `proposal types is not "Membership"`
    )
    assert.equal(
      votingSharesRequested,
      VOTING_SHARES_REQUESTED,
      `voting shares requested is not ${VOTING_SHARES_REQUESTED}`
    )
    assert.equal(
      phase,
      PROPOSAL_PHASES.Proposed,
      `proposal phase is not "Proposed"`
    )

    const [
      prospectiveMemberAddress,
      ethTributeAmount,
      tokenTributeAddresses,
      tokenTributeAmounts
    ] = await moloch.getProposalMemberDetails.call(currentProposalIndex.plus(1))
    assert.equal(
      prospectiveMemberAddress,
      PROSPECTIVE_MEMBERS[1],
      `Prospective member address not correct`
    )
    assert.equal(ethTributeAmount, 0, `eth tribute amount incorrect`)
    assert.equal(
      tokenTributeAddresses.length,
      1,
      `token tribute should have 1 address`
    )
    assert.equal(
      tokenTributeAddresses[0],
      token.address,
      `token tribute address not in contract`
    )
    assert.equal(
      tokenTributeAmounts[0],
      TRIBUTE,
      `token tribute not recognized`
    )
  })
})

// verify create/failure member proposal
// verify create/failure project proposal
// verify create/failure start proposal vote
// verify create/failure vote on current proposal
// verify create/failure transition proposal to grace period
// verify create/failure finish proposal

// verify shares
// verify tokens

// verify tokens/ETH on member application rejection

// verify member exit
// verify member exit burned voting tokens
// verify member exit loot tokens calculation
// verify loot tokens decremented correctly on member exit
// verify exited member no longer has voting ability

/*
  TEST STATES
  1. deploy
  2. donation
  3. membership proposal (exit at any time)
  - start voting
  - voting
  - grace period
  - membership success
  - membership failure
  - finish
  4. project proposal (exit at any time)
  - start voting
  - voting
  - grace period
  - project success
  - project failure
  - finish
  */

/* global artifacts, contract, assert, web3 */
/* eslint-env mocha */

/*

const Moloch = artifacts.require('./Moloch')
const VotingShares = artifacts.require('./VotingShares')
const LootToken = artifacts.require('./LootToken')
const GuildBank = artifacts.require('./GuildBank')
const SimpleToken = artifacts.require('./SimpleToken')
const Voting = artifacts.require('./Voting')

contract('Moloch', accounts => {
  const FOUNDING_MEMBER_1 = accounts[9]
  const FOUNDING_MEMBER_2 = accounts[8]
  const MOLOCH_ADMIN = accounts[0]

  before('should add founding members moloch with founders', async () => {
    this.FOUNDING_MEMBERS = [
      {
        memberAddress: FOUNDING_MEMBER_1,
        votingShares: 100
      },
      {
        memberAddress: FOUNDING_MEMBER_2,
        votingShares: 200
      }
    ]

    this.moloch = await Moloch.deployed()
    const votingShares = await VotingShares.deployed()
    const lootToken = await LootToken.deployed()
    const guildBank = await GuildBank.deployed()

    // transfer ownership of dependent contracts to moloch contract
    await Promise.all([
      votingShares.transferOwnership(this.moloch.address, {
        from: MOLOCH_ADMIN
      }),
      lootToken.transferOwnership(this.moloch.address, { from: MOLOCH_ADMIN }),
      guildBank.transferOwnership(this.moloch.address, { from: MOLOCH_ADMIN })
    ])

    let [votingSharesAddr, lootTokenAddr, guildBankAddr] = await Promise.all([
      this.moloch.votingShares.call(),
      this.moloch.lootToken.call(),
      this.moloch.guildBank.call()
    ])

    assert.equal(
      votingSharesAddr,
      votingShares.address,
      'VotingShares contract address incorrect'
    )
    assert.equal(
      lootTokenAddr,
      lootToken.address,
      'LootToken contract address incorrect'
    )
    assert.equal(
      guildBankAddr,
      guildBank.address,
      'GuildBank contract address incorrect'
    )

    await Promise.all(
      this.FOUNDING_MEMBERS.map(async (member, index) => {
        let mem = await this.moloch.getMember.call(member.memberAddress)
        assert.equal(mem, false, 'Member was approved before adding to guild')

        await this.moloch.addFoundingMember(
          member.memberAddress,
          member.votingShares,
          { from: MOLOCH_ADMIN }
        )

        mem = await this.moloch.getMember.call(member.memberAddress)
        assert.equal(mem, true, 'Member was not approved after adding to guild')
      })
    )
  })

  it('should be owned', async () => {
    const owner = await this.moloch.owner.call()
    assert.equal(owner, MOLOCH_ADMIN, 'Owner is incorrect')
  })

  it('should mint voting shares and loot tokens', async () => {
    const votingSharesAddr = await this.moloch.votingShares.call()
    const votingShares = await VotingShares.at(votingSharesAddr)
    const lootTokenAddr = await this.moloch.lootToken.call()
    const lootToken = await LootToken.at(lootTokenAddr)

    await Promise.all(
      this.FOUNDING_MEMBERS.map(async (member, index) => {
        const balance = await votingShares.balanceOf.call(member.memberAddress)
        assert.equal(
          balance.toNumber(),
          member.votingShares,
          'Voting shares incorrectly minted'
        )
      })
    )

    const lootTokens = await lootToken.balanceOf(this.moloch.address)
    const totalLootTokens = this.FOUNDING_MEMBERS.reduce(
      (total, member) => total + member.votingShares,
      0
    )
    assert.equal(
      lootTokens.toNumber(),
      totalLootTokens,
      'Loot tokens incorrectly minted'
    )
  })

  const PROPOSAL_TYPE_MEMBERSHIP = 0
  const PROPOSAL_PHASE_PROPOSED = 0
  const PROPOSAL_PHASE_VOTING = 1

  it('should submit application with eth', async () => {
    const ETH_TRIBUTE = web3.toWei(1, 'ether')
    const VOTING_SHARES = 1000
    const APPLICANT_ADDRESS = accounts[2]

    // check current proposal index
    const index = await this.moloch.getCurrentProposalIndex.call()
    assert.equal(index, 0, 'Current proposal index did not start at 0')

    await this.moloch.createMemberProposal(
      APPLICANT_ADDRESS,
      [],
      [],
      VOTING_SHARES,
      {
        from: FOUNDING_MEMBER_1,
        value: ETH_TRIBUTE
      }
    )

    const proposal = await this.moloch.getCurrentProposalCommonDetails.call()
    assert.equal(proposal[0], FOUNDING_MEMBER_1, 'Proposer address incorrect')
    assert.equal(
      proposal[1],
      PROPOSAL_TYPE_MEMBERSHIP,
      'Proposal type is not "membership"'
    )
    assert.equal(proposal[2], VOTING_SHARES, 'Proposal voting shares incorrect')
    assert.equal(
      proposal[3],
      PROPOSAL_PHASE_PROPOSED,
      'Proposal phase is not "proposed"'
    )
  })

  it('should start voting process', async () => {
    await this.moloch.startProposalVote({ from: FOUNDING_MEMBER_2 })

    const proposal = await this.moloch.getCurrentProposalCommonDetails.call()
    assert.equal(
      proposal[3],
      PROPOSAL_PHASE_VOTING,
      'Proposal phase is not "voting"'
    )

    const votingSharesAddr = await this.moloch.votingShares.call()
    const votingShares = await VotingShares.at(votingSharesAddr)
    const totalSupply = await votingShares.totalSupply.call()

    const ballot = await this.moloch.getCurrentProposalBallot.call()
    assert.equal(
      ballot[1].toNumber(),
      totalSupply.div(2).toNumber(),
      'Num votes required is not half of the total supply'
    )
  })

  const VOTE_FOR = 1
  const VOTE_AGAINST = 0
  it('should accept votes from members', async () => {
    await this.moloch.voteOnCurrentProposal(VOTE_AGAINST, {
      from: FOUNDING_MEMBER_1
    })

    let ballot = await this.moloch.getCurrentProposalBallot.call()
    assert.equal(
      ballot[2].toNumber(),
      VOTE_AGAINST,
      'Votes not properly counted during voting period'
    )

    await this.moloch.voteOnCurrentProposal(VOTE_FOR, {
      from: FOUNDING_MEMBER_2
    })

    ballot = await this.moloch.getCurrentProposalBallot.call()
    assert.equal(
      ballot[2].toNumber(),
      VOTE_FOR,
      'Votes not properly counted during voting period'
    )
  })

  const VOTING_PERIOD_DURATION = 1 * 1000
  const PROPOSAL_PHASE_GRACE_PERIOD = 2
  it('should allow start grace period once voting is completed', async () => {
    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, VOTING_PERIOD_DURATION + 1000)
    })

    await this.moloch.transitionProposalToGracePeriod({
      from: FOUNDING_MEMBER_2
    })

    const proposal = await this.moloch.getCurrentProposalCommonDetails.call()
    assert.equal(
      proposal[3],
      PROPOSAL_PHASE_GRACE_PERIOD,
      'Proposal phase is not "GracePeriod"'
    )
  })

  const GRACE_PERIOD_DURATION = 1 * 1000
  it('should complete vote and accept member', async () => {
    const APPLICANT_ADDRESS = accounts[2]
    const VOTING_SHARES = 1000

    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, GRACE_PERIOD_DURATION + 1000)
    })

    let member = await this.moloch.getMember(APPLICANT_ADDRESS)
    assert.equal(member, false, 'member was accepted before being voted in')

    const lootTokenAddr = await this.moloch.lootToken.call()
    const lootToken = await LootToken.at(lootTokenAddr)
    const startingLootToken = await lootToken.balanceOf(this.moloch.address)

    await this.moloch.finishProposal({
      from: FOUNDING_MEMBER_2
    })

    member = await this.moloch.getMember(APPLICANT_ADDRESS)
    assert.equal(member, true, 'member was accepted')

    const votingSharesAddr = await this.moloch.votingShares.call()
    const votingShares = await VotingShares.at(votingSharesAddr)
    const balance = await votingShares.balanceOf(APPLICANT_ADDRESS)
    assert.equal(balance, VOTING_SHARES, 'voting shares were not granted')

    const endingLootTokens = await lootToken.balanceOf(this.moloch.address)
    assert.equal(
      endingLootTokens.minus(startingLootToken),
      VOTING_SHARES,
      'incorrect number of loot tokens minted'
    )
  })
})
*/
