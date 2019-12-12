# Project Upgrades
An upgrade is used to fix breaking change that happens to a file in the project, typically that a cutomer would have to manually do otherwise. The project upgrade is usually a one-time interacitve command that the customer will run on a project after a release with breaking project changes. 

```bash
sfdx upgrade
sfdx force:project:upgrade
```

The upgrader will execute each *upgrade function* (for example [heads-down-project.ts](./upgrades/heads-down-project.ts)) listed in the [upgraders `actionsFns` array](./upgrades.ts#L33) and should all be stored in the [upgrades folder](./upgrades/). The *upgrade function* should determine if the project needs that particular upgrade and, if so, then return an [UpgradeAction](./upgrades/UpgradeAction.ts). This `actionsFns` array should be kept IN ORDER of when an *upgrade function* is added. This enabled the upgrader to only run an *upgrade function* once per workspace, and pick up new ones when added.

For example, let't take heads down camel case of the sfdx-project.json file.

```bash
# Will update to headsDown
sfdx force:project:upgrade 

# Will do nothing because we already ran the all the upgrades and cached in <project>/.sfdx/upgrade-state.txt
sfdx force:project:upgrade

# Will do nothing because the upgrade function will determine it has already been done
sfdx force:project:upgrade --forceupgrade
```
Once the upgrader retrieves all the [UpgradeAction](./upgrades/UpgradeAction.ts) returned by the *upgrade functions* that need to run, it will prompt the user with the actions to make sure they want to continue. Therefore it is important to **NEVER** change any files in the *upgrade functions* and **only** in the returned [UpgradeAction](./upgrades/UpgradeAction.ts).

## Creating an Upgrade Function

Make sure you read the description above, but here is a list of steps to creat an *upgrade function*.

1. Create a new *upgrade function* based off of [heads-down-project.ts](./upgrades/heads-down-project.ts)
1. Import that file in [upgraders](./upgrades.ts) and add to the `actionsFns`.
1. Use the passed in project directory, and use the prompt if you need to ask the user a question before you can determine if you need to take an action. For example [org-def-conversion](./upgrades/org-def-conversion.ts). You **CANNOT** assume that the other update actions have ran before at this point.
1. If you need to take action, return an UpgradeAction with an appropate description so the user knows what is going to happen. Reframe from having too long of a description to keep the list clean. It is also helpful if you return how many things your action is going to change. Also look in org-def-conversion for an example of that.
1. In the UpdateAction's action function, perform the update. You **can** assume that all actions prior to yours will be done before yours at this point.