export enum EmailPattern {
	FirstNameDotLastName = "{firstName}.{lastName}",
	FirstNameLastName = "{firstName}{lastName}",
	FirstInitialLastName = "{firstInitial}{lastName}",
	FirstInitialDotLastName = "{firstInitial}.{lastName}",
	FirstNameLastInitial = "{firstName}{lastInitial}",
	FirstNameDotLastInitial = "{firstName}.{lastInitial}",
	FirstNameUnderscoreLastName = "{firstName}_{lastName}",
	FirstNameHyphenLastName = "{firstName}-{lastName}",
	LastNameDotFirstName = "{lastName}.{firstName}",
	LastNameFirstName = "{lastName}{firstName}",
	LastNameFirstInitial = "{lastName}{firstInitial}",
	FirstName = "{firstName}",
	LastName = "{lastName}",
	FirstInitialLastInitial = "{firstInitial}{lastInitial}",
}

type GenerateEmail = (firstName: string, lastName: string) => string;

export const generateEmailLocalPartMap: Record<EmailPattern, GenerateEmail> = {
	[EmailPattern.FirstNameDotLastName]: (firstName, lastName) =>
		`${firstName}.${lastName}`,
	[EmailPattern.FirstNameLastName]: (firstName, lastName) =>
		`${firstName}${lastName}`,
	[EmailPattern.FirstInitialLastName]: (firstName, lastName) =>
		`${firstName[0]}${lastName}`,
	[EmailPattern.FirstInitialDotLastName]: (firstName, lastName) =>
		`${firstName[0]}.${lastName}`,
	[EmailPattern.FirstNameLastInitial]: (firstName, lastName) =>
		`${firstName}${lastName[0]}`,
	[EmailPattern.FirstNameDotLastInitial]: (firstName, lastName) =>
		`${firstName}.${lastName[0]}`,
	[EmailPattern.FirstNameUnderscoreLastName]: (firstName, lastName) =>
		`${firstName}_${lastName}`,
	[EmailPattern.FirstNameHyphenLastName]: (firstName, lastName) =>
		`${firstName}-${lastName}`,
	[EmailPattern.LastNameDotFirstName]: (firstName, lastName) =>
		`${lastName}.${firstName}`,
	[EmailPattern.LastNameFirstName]: (firstName, lastName) =>
		`${lastName}${firstName}`,
	[EmailPattern.LastNameFirstInitial]: (firstName, lastName) =>
		`${lastName}${firstName[0]}`,
	[EmailPattern.FirstName]: (firstName) => firstName,
	[EmailPattern.LastName]: (_, lastName) => lastName,
	[EmailPattern.FirstInitialLastInitial]: (firstName, lastName) =>
		`${firstName[0]}${lastName[0]}`,
};
